import type { UtangRecord } from './hooks/useUtang';
import type { PaymentHistoryRecord } from './payment-source';
import { getTransactionReceiptReference } from './vendor-transaction-recovery';

export type ProofPeriodKind = '7d' | '30d' | 'all';

export interface ProofPeriod {
  kind: ProofPeriodKind;
  label: string;
}

export interface ProofVendor {
  name: string;
  wallet: string;
  stallNumber?: string;
  productType?: string;
}

export interface ProofSummaryInput {
  vendor: ProofVendor;
  transactions: PaymentHistoryRecord[];
  period: ProofPeriod;
  generatedAt?: string;
  phpPerXlm?: number;
  livePaymentTxHash?: string;
  hasLivePaymentProof?: boolean;
  repaymentDataPresent?: boolean;
}

export interface ProofReadiness {
  label: string;
  paymentDataPresent: boolean;
  repaymentDataPresent: boolean;
  liveProofMissing: boolean;
}

export interface ProofDateRange {
  from: string | null;
  to: string | null;
  label: string;
}

export interface ProofSummary {
  generatedAt: string;
  vendor: ProofVendor;
  period: ProofPeriod;
  dateRange: ProofDateRange;
  transactions: PaymentHistoryRecord[];
  totalXlm: number;
  transactionCount: number;
  averageXlm: number;
  uniqueCustomers: number;
  sourceLabel: string;
  hasFallbackCaveat: boolean;
  estimatedPhpTotal: number | null;
  caveats: string[];
  readiness: ProofReadiness;
}

export interface IncomeProofCertificate {
  title: string;
  audience: string;
  vendorLine: string;
  reviewStatus: string;
  generatedLine: string;
  highlights: Array<{ label: string; value: string }>;
  attestation: string;
  verificationNotes: string[];
}

export interface CollectionsSummary {
  activeAgreements: number;
  completedAgreements: number;
  defaultedAgreements: number;
  overdueAgreements: number;
  totalOutstandingXlm: number;
  totalCollectedXlm: number;
  sourceLabel: string;
  caveats: string[];
}

const STROOPS_PER_XLM = 10_000_000;

export const PROOF_PERIODS: ProofPeriod[] = [
  { kind: '7d', label: '7 days' },
  { kind: '30d', label: '30 days' },
  { kind: 'all', label: 'All' },
];

export function filterTransactionsByPeriod(
  transactions: PaymentHistoryRecord[],
  period: ProofPeriod,
  now = new Date(),
): PaymentHistoryRecord[] {
  if (period.kind === 'all') return [...transactions];

  const days = period.kind === '7d' ? 7 : 30;
  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000;
  return transactions.filter((payment) => new Date(payment.createdAt).getTime() >= cutoff);
}

export function filterTransactionsBySearch(
  transactions: PaymentHistoryRecord[],
  searchTerm: string,
): PaymentHistoryRecord[] {
  const query = searchTerm.trim().toLowerCase();
  if (!query) return [...transactions];

  return transactions.filter((payment) => {
    const receipt = getTransactionReceiptReference(payment);
    return [
      payment.id,
      payment.txHash,
      payment.paymentId !== undefined ? String(payment.paymentId) : undefined,
      payment.from,
      payment.memo,
      payment.source,
      payment.amountXlm.toFixed(2),
      payment.amountXlm.toFixed(7),
      receipt.label,
      receipt.value,
      receipt.lookupUrl,
      payment.quote ? payment.quote.phpAmount.toFixed(2) : undefined,
      payment.quote ? payment.quote.phpPerXlm.toFixed(2) : undefined,
    ].some((value) => value?.toLowerCase().includes(query));
  });
}

export function buildProofSummary(input: ProofSummaryInput): ProofSummary {
  const totalXlm = roundXlm(input.transactions.reduce((sum, payment) => sum + payment.amountXlm, 0));
  const transactionCount = input.transactions.length;
  const preservedPhpTotal = getPreservedPhpTotal(input.transactions);
  const hasLivePaymentProof = !!input.livePaymentTxHash || !!input.hasLivePaymentProof || input.transactions.some((payment) => !!payment.txHash);
  const uniqueCustomers = new Set(input.transactions.map((payment) => payment.from)).size;
  const sourceLabel = getSourceLabel(input.transactions);
  const hasFallbackCaveat = input.transactions.some((payment) => payment.source !== 'palengke-payment');
  const caveats: string[] = ['Testnet exports are demo evidence until mainnet/audit status changes.'];

  if (transactionCount === 0) {
    caveats.push('No payment rows are available for the selected period.');
  }
  if (hasFallbackCaveat) {
    caveats.push('Includes Horizon/cache fallback rows; fallback rows are not the canonical payment contract source.');
  }
  if (!hasLivePaymentProof) {
    caveats.push('Live wallet-signed payment smoke is not attached to this export.');
  }
  if (!input.repaymentDataPresent) {
    caveats.push('Repayment records are not attached to this payment proof pack.');
  }
  if (transactionCount > 0 && preservedPhpTotal === null && !input.phpPerXlm) {
    caveats.push('PHP quote data is not attached to every payment row, so PHP totals are unavailable.');
  }

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    vendor: input.vendor,
    period: input.period,
    dateRange: buildDateRange(input.transactions, input.period),
    transactions: [...input.transactions],
    totalXlm,
    transactionCount,
    averageXlm: transactionCount > 0 ? roundXlm(totalXlm / transactionCount) : 0,
    uniqueCustomers,
    sourceLabel,
    hasFallbackCaveat,
    estimatedPhpTotal: preservedPhpTotal ?? (input.phpPerXlm ? roundCurrency(totalXlm * input.phpPerXlm) : null),
    caveats,
    readiness: {
      label: transactionCount > 0 && hasLivePaymentProof ? 'Ready for review' : 'Needs live proof',
      paymentDataPresent: transactionCount > 0,
      repaymentDataPresent: !!input.repaymentDataPresent,
      liveProofMissing: !hasLivePaymentProof,
    },
  };
}

export function toProofCsv(summary: ProofSummary): string {
  const rows = [
    'date,amount_xlm,php_amount,php_per_xlm,memo,customer_wallet,receipt_reference_type,receipt_reference,receipt_lookup_url,source',
    ...summary.transactions.map((payment) => {
      const receipt = getTransactionReceiptReference(payment);
      return [
        payment.createdAt,
        payment.amountXlm.toFixed(7),
        payment.quote ? payment.quote.phpAmount.toFixed(2) : '',
        payment.quote ? payment.quote.phpPerXlm.toFixed(4) : '',
        csvCell(payment.memo ?? ''),
        shortenWallet(payment.from),
        csvCell(receipt.label),
        csvCell(receipt.value),
        receipt.lookupUrl ?? '',
        getSourceLabel([payment]),
      ].join(',');
    }),
  ];

  return `${rows.join('\n')}\n`;
}

export function buildProofBundle(summary: ProofSummary) {
  return {
    generatedAt: summary.generatedAt,
    vendor: summary.vendor,
    period: summary.period,
    dateRange: summary.dateRange,
    totals: {
      totalXlm: summary.totalXlm,
      transactionCount: summary.transactionCount,
      averageXlm: summary.averageXlm,
      uniqueCustomers: summary.uniqueCustomers,
      estimatedPhpTotal: summary.estimatedPhpTotal,
    },
    source: {
      label: summary.sourceLabel,
      hasFallbackCaveat: summary.hasFallbackCaveat,
    },
    caveats: summary.caveats,
    transactions: summary.transactions.map((payment) => ({
      ...payment,
      receiptReference: getTransactionReceiptReference(payment),
    })),
  };
}

export function buildIncomeProofCertificate(summary: ProofSummary): IncomeProofCertificate {
  return {
    title: 'PalengkePay Income Proof Certificate',
    audience: 'Prepared for lender, cooperative, LGU, or aid-program review.',
    vendorLine: [
      summary.vendor.name,
      summary.vendor.stallNumber ? `Stall ${summary.vendor.stallNumber}` : null,
      summary.vendor.productType,
    ].filter(Boolean).join(' · '),
    reviewStatus: summary.readiness.label,
    generatedLine: `Generated ${formatDateTime(summary.generatedAt)} for ${summary.period.label}`,
    highlights: [
      { label: 'Transactions', value: String(summary.transactionCount) },
      { label: 'Total XLM', value: `${summary.totalXlm.toFixed(2)} XLM` },
      { label: 'PHP estimate', value: summary.estimatedPhpTotal !== null ? `PHP ${summary.estimatedPhpTotal.toFixed(2)}` : 'Unavailable' },
      { label: 'Source', value: summary.sourceLabel },
    ],
    attestation: summary.readiness.liveProofMissing
      ? 'Needs a wallet-signed Testnet transaction hash before external review.'
      : 'Includes at least one wallet-signed Testnet transaction reference for review.',
    verificationNotes: [
      `Date range: ${summary.dateRange.label}`,
      `Unique customers: ${summary.uniqueCustomers}`,
      ...summary.caveats,
    ],
  };
}

export function buildCollectionsSummary(utangs: UtangRecord[], now = new Date()): CollectionsSummary {
  let activeAgreements = 0;
  let completedAgreements = 0;
  let defaultedAgreements = 0;
  let overdueAgreements = 0;
  let totalOutstandingXlm = 0;
  let totalCollectedXlm = 0;
  const nowSecs = BigInt(Math.floor(now.getTime() / 1000));

  for (const utang of utangs) {
    const paid = roundXlm(utang.installmentAmountXlm * utang.installmentsPaid);
    totalCollectedXlm += paid;

    if (utang.status === 'active') {
      activeAgreements += 1;
      totalOutstandingXlm += Math.max(0, utang.totalAmountXlm - paid);
      if (utang.nextDueSecs < nowSecs) overdueAgreements += 1;
    } else if (utang.status === 'completed') {
      completedAgreements += 1;
    } else if (utang.status === 'defaulted') {
      defaultedAgreements += 1;
      totalOutstandingXlm += Math.max(0, utang.totalAmountXlm - paid);
    }
  }

  return {
    activeAgreements,
    completedAgreements,
    defaultedAgreements,
    overdueAgreements,
    totalOutstandingXlm: roundXlm(totalOutstandingXlm),
    totalCollectedXlm: roundXlm(totalCollectedXlm),
    sourceLabel: 'UtangEscrow records',
    caveats: [
      'Repayment totals are based on UtangEscrow records currently available to this wallet.',
      'PHP conversion is not attached to this collections proof.',
    ],
  };
}

function getSourceLabel(transactions: PaymentHistoryRecord[]): string {
  if (transactions.length === 0) return 'Unavailable';
  const sources = new Set(transactions.map((payment) => payment.source));
  if (sources.size > 1) return 'Mixed/unverified records';
  return sources.has('palengke-payment') ? 'Contract records' : 'Horizon/cache fallback';
}

function getPreservedPhpTotal(transactions: PaymentHistoryRecord[]): number | null {
  if (transactions.length === 0) return null;
  if (transactions.some((payment) => !payment.quote)) return null;
  return roundCurrency(transactions.reduce((sum, payment) => sum + (payment.quote?.phpAmount ?? 0), 0));
}

function buildDateRange(transactions: PaymentHistoryRecord[], period: ProofPeriod): ProofDateRange {
  if (transactions.length === 0) {
    return { from: null, to: null, label: `No records in ${period.label}` };
  }

  const times = transactions
    .map((payment) => new Date(payment.createdAt).getTime())
    .filter(Number.isFinite);
  if (times.length === 0) {
    return { from: null, to: null, label: period.label };
  }

  const from = new Date(Math.min(...times)).toISOString();
  const to = new Date(Math.max(...times)).toISOString();
  return {
    from,
    to,
    label: `${formatDate(from)} - ${formatDate(to)}`,
  };
}

function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(isoDate));
}

function formatDateTime(isoDate: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(isoDate));
}

function shortenWallet(wallet: string): string {
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

function roundXlm(value: number): number {
  return Math.round(value * STROOPS_PER_XLM) / STROOPS_PER_XLM;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function csvCell(value: string): string {
  if (!/[",\n]/.test(value)) return value;
  return `"${value.replaceAll('"', '""')}"`;
}
