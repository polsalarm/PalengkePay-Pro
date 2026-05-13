import type { UtangRecord } from './hooks/useUtang';
import type { PaymentHistoryRecord } from './payment-source';

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

export interface ProofSummary {
  generatedAt: string;
  vendor: ProofVendor;
  period: ProofPeriod;
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

export function buildProofSummary(input: ProofSummaryInput): ProofSummary {
  const totalXlm = roundXlm(input.transactions.reduce((sum, payment) => sum + payment.amountXlm, 0));
  const transactionCount = input.transactions.length;
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
  if (!input.livePaymentTxHash && !input.hasLivePaymentProof) {
    caveats.push('Live wallet-signed payment smoke is not attached to this export.');
  }
  if (!input.repaymentDataPresent) {
    caveats.push('Repayment records are not attached to this payment proof pack.');
  }

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    vendor: input.vendor,
    period: input.period,
    transactions: [...input.transactions],
    totalXlm,
    transactionCount,
    averageXlm: transactionCount > 0 ? roundXlm(totalXlm / transactionCount) : 0,
    uniqueCustomers,
    sourceLabel,
    hasFallbackCaveat,
    estimatedPhpTotal: input.phpPerXlm ? roundCurrency(totalXlm * input.phpPerXlm) : null,
    caveats,
    readiness: {
      label: transactionCount > 0 && (input.livePaymentTxHash || input.hasLivePaymentProof) ? 'Ready for review' : 'Needs live proof',
      paymentDataPresent: transactionCount > 0,
      repaymentDataPresent: !!input.repaymentDataPresent,
      liveProofMissing: !input.livePaymentTxHash && !input.hasLivePaymentProof,
    },
  };
}

export function toProofCsv(summary: ProofSummary): string {
  const rows = [
    'date,amount_xlm,memo,customer_wallet,tx_hash,source',
    ...summary.transactions.map((payment) => [
      payment.createdAt,
      payment.amountXlm.toFixed(7),
      csvCell(payment.memo ?? ''),
      shortenWallet(payment.from),
      payment.txHash ?? payment.id,
      getSourceLabel([payment]),
    ].join(',')),
  ];

  return `${rows.join('\n')}\n`;
}

export function buildProofBundle(summary: ProofSummary) {
  return {
    generatedAt: summary.generatedAt,
    vendor: summary.vendor,
    period: summary.period,
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
    transactions: summary.transactions,
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
  if (sources.size > 1) return 'Mixed contract and fallback records';
  return sources.has('palengke-payment') ? 'Contract records' : 'Horizon/cache fallback';
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
