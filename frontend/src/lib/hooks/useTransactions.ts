import { useState, useEffect, useCallback } from 'react';
import { syncPayments, getCachedPayments } from '../indexer';
import type { IndexedPayment } from '../indexer';

export interface TxRecord {
  id: string;
  from: string;
  to: string;
  amountXlm: number;
  createdAt: string;
  memo?: string;
}

export function useVendorTransactions(vendorWallet: string | null) {
  const [transactions, setTransactions] = useState<TxRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toTxRecord = (p: IndexedPayment): TxRecord => p;

  const load = useCallback(async (wallet: string) => {
    // Show cache immediately, then sync in background
    const cached = getCachedPayments(wallet).filter((p) => p.to === wallet);
    if (cached.length > 0) setTransactions(cached.map(toTxRecord));

    setIsLoading(true);
    setError(null);
    try {
      const all = await syncPayments(wallet);
      setTransactions(all.filter((p) => p.to === wallet).map(toTxRecord));
    } catch (e: unknown) {
      setError((e as { message?: string }).message ?? 'Failed to load transactions');
      if (transactions.length === 0) setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!vendorWallet) return;
    load(vendorWallet);
    const interval = setInterval(() => load(vendorWallet), 30_000);
    return () => clearInterval(interval);
  }, [vendorWallet, load]);

  const todayEarnings = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return transactions
      .filter((t) => new Date(t.createdAt) >= today)
      .reduce((sum, t) => sum + t.amountXlm, 0);
  }, [transactions]);

  const todayCount = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return transactions.filter((t) => new Date(t.createdAt) >= today).length;
  }, [transactions]);

  const retry = useCallback(() => { if (vendorWallet) load(vendorWallet); }, [vendorWallet, load]);

  return { transactions, isLoading, error, retry, todayEarnings, todayCount };
}

export function useCustomerTransactions(customerWallet: string | null) {
  const [transactions, setTransactions] = useState<TxRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (wallet: string) => {
    const cached = getCachedPayments(wallet).filter((p) => p.from === wallet);
    if (cached.length > 0) setTransactions(cached);

    setIsLoading(true);
    setError(null);
    try {
      const all = await syncPayments(wallet);
      setTransactions(all.filter((p) => p.from === wallet));
    } catch (e: unknown) {
      setError((e as { message?: string }).message ?? 'Failed to load transactions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!customerWallet) return;
    load(customerWallet);
    const interval = setInterval(() => load(customerWallet), 30_000);
    return () => clearInterval(interval);
  }, [customerWallet, load]);

  const retry = useCallback(() => { if (customerWallet) load(customerWallet); }, [customerWallet, load]);

  return { transactions, isLoading, error, retry };
}

export function relativeTime(isoDate: string): string {
  if (!isoDate) return '';
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
