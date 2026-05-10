import { useMemo } from 'react';
import { useAllVendors, usePendingVendors } from './useVendor';

export interface MetricSummary {
  totalVendors: number;
  activeVendors: number;
  pendingVendors: number;
  totalVolumeXlm: number;
  totalTransactions: number;
  avgTxXlm: number;
}

export interface ProductBreakdown {
  type: string;
  count: number;
  volumeXlm: number;
  pct: number;
}

export interface TopVendor {
  name: string;
  stallNumber: string;
  productType: string;
  totalTransactions: number;
  volumeXlm: number;
}

export function useMetrics() {
  const { vendors, isLoading: vendorsLoading, error: vendorsError, refetch } = useAllVendors();
  const { applications, isLoading: pendingLoading } = usePendingVendors();

  const summary = useMemo<MetricSummary>(() => {
    const active = vendors.filter((v) => v.isActive);
    const totalVolumeXlm = vendors.reduce((s, v) => s + Number(v.totalVolume) / 10_000_000, 0);
    const totalTransactions = vendors.reduce((s, v) => s + v.totalTransactions, 0);
    return {
      totalVendors: vendors.length,
      activeVendors: active.length,
      pendingVendors: applications.length,
      totalVolumeXlm,
      totalTransactions,
      avgTxXlm: totalTransactions > 0 ? totalVolumeXlm / totalTransactions : 0,
    };
  }, [vendors, applications]);

  const productBreakdown = useMemo<ProductBreakdown[]>(() => {
    const map = new Map<string, { count: number; volumeXlm: number }>();
    for (const v of vendors) {
      const key = v.productType || 'other';
      const existing = map.get(key) ?? { count: 0, volumeXlm: 0 };
      map.set(key, {
        count: existing.count + 1,
        volumeXlm: existing.volumeXlm + Number(v.totalVolume) / 10_000_000,
      });
    }
    const total = vendors.length || 1;
    return Array.from(map.entries())
      .map(([type, { count, volumeXlm }]) => ({ type, count, volumeXlm, pct: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count);
  }, [vendors]);

  const topVendors = useMemo<TopVendor[]>(() => (
    [...vendors]
      .filter((v) => v.isActive)
      .sort((a, b) => Number(b.totalVolume) - Number(a.totalVolume))
      .slice(0, 5)
      .map((v) => ({
        name: v.name,
        stallNumber: v.stallNumber,
        productType: v.productType,
        totalTransactions: v.totalTransactions,
        volumeXlm: Number(v.totalVolume) / 10_000_000,
      }))
  ), [vendors]);

  return {
    summary,
    productBreakdown,
    topVendors,
    isLoading: vendorsLoading || pendingLoading,
    error: vendorsError,
    refetch,
  };
}
