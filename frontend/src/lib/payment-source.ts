import { addressToScVal, simulateViewCall, u32ToScVal } from './stellar';
import { getPaymentContractId } from './payment-routing';
import type { IndexedPayment } from './indexer';

const STROOPS_PER_XLM = 10_000_000;

export type PaymentHistorySource = 'palengke-payment' | 'fee-bump';

export interface PaymentHistoryRecord {
  id: string;
  paymentId?: number;
  txHash?: string;
  from: string;
  to: string;
  amountXlm: number;
  createdAt: string;
  memo?: string;
  source: PaymentHistorySource;
}

export interface ContractPaymentPayload {
  id: number | string | bigint;
  customer: string;
  vendor: string;
  amount: number | string | bigint;
  timestamp: number | string | bigint;
  memo?: string;
}

export interface MetricVendor {
  wallet: string;
  name: string;
  stallNumber: string;
  productType: string;
  isActive: boolean;
}

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
  wallet?: string;
  name: string;
  stallNumber: string;
  productType: string;
  totalTransactions: number;
  volumeXlm: number;
}

export interface PaymentMetrics {
  summary: MetricSummary;
  productBreakdown: ProductBreakdown[];
  topVendors: TopVendor[];
}

export function normalizeContractPayment(payment: ContractPaymentPayload): PaymentHistoryRecord {
  const paymentId = Number(payment.id);
  return {
    id: `palengke-payment:${paymentId}`,
    paymentId,
    from: String(payment.customer),
    to: String(payment.vendor),
    amountXlm: Number(BigInt(payment.amount)) / STROOPS_PER_XLM,
    createdAt: new Date(Number(BigInt(payment.timestamp)) * 1000).toISOString(),
    memo: payment.memo ? String(payment.memo) : undefined,
    source: 'palengke-payment',
  };
}

export function normalizeFallbackPayment(payment: IndexedPayment): PaymentHistoryRecord {
  return {
    id: `horizon:${payment.id}`,
    txHash: payment.id,
    from: payment.from,
    to: payment.to,
    amountXlm: payment.amountXlm,
    createdAt: payment.createdAt,
    memo: payment.memo,
    source: 'fee-bump',
  };
}

export function mergePaymentHistory(
  contractPayments: PaymentHistoryRecord[],
  fallbackPayments: PaymentHistoryRecord[],
): PaymentHistoryRecord[] {
  const fingerprints = new Set(contractPayments.map(paymentFingerprint));
  const merged = [
    ...contractPayments,
    ...fallbackPayments.filter((payment) => !fingerprints.has(paymentFingerprint(payment))),
  ];

  return merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function buildPaymentMetrics(
  vendors: MetricVendor[],
  payments: PaymentHistoryRecord[],
  pendingVendors: number,
): PaymentMetrics {
  const paymentTotals = new Map<string, { totalTransactions: number; volumeXlm: number }>();
  for (const payment of payments) {
    const existing = paymentTotals.get(payment.to) ?? { totalTransactions: 0, volumeXlm: 0 };
    paymentTotals.set(payment.to, {
      totalTransactions: existing.totalTransactions + 1,
      volumeXlm: existing.volumeXlm + payment.amountXlm,
    });
  }

  const active = vendors.filter((vendor) => vendor.isActive);
  const totalVolumeXlm = payments.reduce((sum, payment) => sum + payment.amountXlm, 0);
  const totalTransactions = payments.length;
  const summary: MetricSummary = {
    totalVendors: vendors.length,
    activeVendors: active.length,
    pendingVendors,
    totalVolumeXlm,
    totalTransactions,
    avgTxXlm: totalTransactions > 0 ? roundXlm(totalVolumeXlm / totalTransactions) : 0,
  };

  const productMap = new Map<string, { count: number; volumeXlm: number }>();
  for (const vendor of vendors) {
    const type = vendor.productType || 'other';
    const existing = productMap.get(type) ?? { count: 0, volumeXlm: 0 };
    productMap.set(type, {
      count: existing.count + 1,
      volumeXlm: existing.volumeXlm + (paymentTotals.get(vendor.wallet)?.volumeXlm ?? 0),
    });
  }

  const total = vendors.length || 1;
  const productBreakdown = Array.from(productMap.entries())
    .map(([type, { count, volumeXlm }]) => ({
      type,
      count,
      volumeXlm,
      pct: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  const topVendors = vendors
    .filter((vendor) => vendor.isActive)
    .map((vendor) => ({
      name: vendor.name,
      wallet: vendor.wallet,
      stallNumber: vendor.stallNumber,
      productType: vendor.productType,
      totalTransactions: paymentTotals.get(vendor.wallet)?.totalTransactions ?? 0,
      volumeXlm: paymentTotals.get(vendor.wallet)?.volumeXlm ?? 0,
    }))
    .sort((a, b) => b.volumeXlm - a.volumeXlm)
    .slice(0, 5);

  return { summary, productBreakdown, topVendors };
}

export function hasPaymentContractSource(): boolean {
  return !!getPaymentContractId()?.trim();
}

export async function fetchVendorContractPayments(vendorWallet: string): Promise<PaymentHistoryRecord[]> {
  return fetchContractPayments('get_vendor_payments', vendorWallet);
}

export async function fetchCustomerContractPayments(customerWallet: string): Promise<PaymentHistoryRecord[]> {
  return fetchContractPayments('get_customer_payments', customerWallet);
}

export async function fetchContractPaymentsForVendors(vendors: MetricVendor[]): Promise<PaymentHistoryRecord[]> {
  const batches = await Promise.all(vendors.map((vendor) => fetchVendorContractPayments(vendor.wallet)));
  const byId = new Map<string, PaymentHistoryRecord>();
  for (const payment of batches.flat()) {
    byId.set(payment.id, payment);
  }
  return Array.from(byId.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

async function fetchContractPayments(method: string, wallet: string): Promise<PaymentHistoryRecord[]> {
  const contractId = getPaymentContractId();
  if (!contractId?.trim()) return [];

  const raw = await simulateViewCall(contractId, method, [
    addressToScVal(wallet),
    u32ToScVal(100),
    u32ToScVal(0),
  ]);

  if (!Array.isArray(raw)) return [];
  return (raw as ContractPaymentPayload[]).map(normalizeContractPayment);
}

function paymentFingerprint(payment: PaymentHistoryRecord): string {
  return [
    payment.from,
    payment.to,
    payment.amountXlm.toFixed(7),
    payment.createdAt,
    payment.memo ?? '',
  ].join('|');
}

function roundXlm(value: number): number {
  return Math.round(value * STROOPS_PER_XLM) / STROOPS_PER_XLM;
}
