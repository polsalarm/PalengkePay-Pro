import { describe, expect, it } from 'vitest';
import type { PaymentHistoryRecord } from './payment-source';
import type { UtangRecord } from './hooks/useUtang';
import {
  buildCollectionsSummary,
  buildProofBundle,
  buildProofSummary,
  filterTransactionsByPeriod,
  toProofCsv,
  type ProofPeriod,
} from './vendor-proof';

const vendorWallet = 'GVENDOR000000000000000000000000000000000000000000000000';
const customerA = 'GCUSTOMERA0000000000000000000000000000000000000000000000';
const customerB = 'GCUSTOMERB0000000000000000000000000000000000000000000000';

function tx(overrides: Partial<PaymentHistoryRecord>): PaymentHistoryRecord {
  return {
    id: 'palengke-payment:1',
    paymentId: 1,
    from: customerA,
    to: vendorWallet,
    amountXlm: 10,
    createdAt: '2026-05-10T00:00:00.000Z',
    memo: 'gulay',
    source: 'palengke-payment',
    ...overrides,
  };
}

function utang(overrides: Partial<UtangRecord>): UtangRecord {
  return {
    id: 1n,
    customerWallet: customerA,
    vendorWallet,
    totalAmountXlm: 12,
    installmentAmountXlm: 4,
    installmentsTotal: 3,
    installmentsPaid: 1,
    nextDueSecs: 1_777_000_000n,
    intervalDays: 7,
    status: 'active',
    description: 'bigas',
    ...overrides,
  };
}

describe('filterTransactionsByPeriod', () => {
  it('keeps only payments inside the selected rolling period', () => {
    const now = new Date('2026-05-14T12:00:00.000Z');
    const period: ProofPeriod = { kind: '7d', label: 'Last 7 days' };

    expect(filterTransactionsByPeriod([
      tx({ id: 'recent', createdAt: '2026-05-12T00:00:00.000Z' }),
      tx({ id: 'old', createdAt: '2026-04-20T00:00:00.000Z' }),
    ], period, now).map((payment) => payment.id)).toEqual(['recent']);
  });
});

describe('buildProofSummary', () => {
  it('summarizes contract-only payment proof without fallback caveats', () => {
    const summary = buildProofSummary({
      vendor: { name: 'Aling Nena', wallet: vendorWallet, stallNumber: 'A-12', productType: 'gulay' },
      transactions: [
        tx({ id: 'a', paymentId: 1, amountXlm: 10, source: 'palengke-payment' }),
        tx({ id: 'b', paymentId: 2, amountXlm: 5, source: 'palengke-payment', from: customerB }),
      ],
      period: { kind: 'all', label: 'All time' },
      generatedAt: '2026-05-14T04:00:00.000Z',
    });

    expect(summary.totalXlm).toBe(15);
    expect(summary.transactionCount).toBe(2);
    expect(summary.averageXlm).toBe(7.5);
    expect(summary.uniqueCustomers).toBe(2);
    expect(summary.sourceLabel).toBe('Contract records');
    expect(summary.hasFallbackCaveat).toBe(false);
    expect(summary.estimatedPhpTotal).toBeNull();
  });

  it('labels mixed-source proof and keeps Testnet/live-proof caveats explicit', () => {
    const summary = buildProofSummary({
      vendor: { name: 'Vendor', wallet: vendorWallet },
      transactions: [
        tx({ id: 'contract', source: 'palengke-payment' }),
        tx({ id: 'fallback', source: 'fee-bump', txHash: 'abc' }),
      ],
      period: { kind: 'all', label: 'All time' },
      generatedAt: '2026-05-14T04:00:00.000Z',
    });

    expect(summary.sourceLabel).toBe('Mixed contract and fallback records');
    expect(summary.hasFallbackCaveat).toBe(true);
    expect(summary.caveats).toContain('Includes Horizon/cache fallback rows; fallback rows are not the canonical payment contract source.');
    expect(summary.caveats).toContain('Live wallet-signed payment smoke is not attached to this export.');
  });

  it('returns an unavailable source label for empty exports', () => {
    const summary = buildProofSummary({
      vendor: { name: 'Vendor', wallet: vendorWallet },
      transactions: [],
      period: { kind: '30d', label: 'Last 30 days' },
      generatedAt: '2026-05-14T04:00:00.000Z',
    });

    expect(summary.sourceLabel).toBe('Unavailable');
    expect(summary.caveats).toContain('No payment rows are available for the selected period.');
  });
});

describe('proof exports', () => {
  it('creates a CSV ledger with source labels and safe customer identifiers', () => {
    const summary = buildProofSummary({
      vendor: { name: 'Aling Nena', wallet: vendorWallet },
      transactions: [tx({ id: 'row-1', txHash: 'hash-1', amountXlm: 3.25 })],
      period: { kind: 'all', label: 'All time' },
      generatedAt: '2026-05-14T04:00:00.000Z',
    });

    expect(toProofCsv(summary)).toContain('date,amount_xlm,memo,customer_wallet,tx_hash,source');
    expect(toProofCsv(summary)).toContain('2026-05-10T00:00:00.000Z,3.2500000,gulay,GCUSTO...0000,hash-1,Contract records');
  });

  it('creates a JSON proof bundle with generated metadata and caveats', () => {
    const summary = buildProofSummary({
      vendor: { name: 'Aling Nena', wallet: vendorWallet },
      transactions: [tx({ id: 'row-1', amountXlm: 2 })],
      period: { kind: 'all', label: 'All time' },
      generatedAt: '2026-05-14T04:00:00.000Z',
    });

    expect(buildProofBundle(summary)).toMatchObject({
      generatedAt: '2026-05-14T04:00:00.000Z',
      vendor: { name: 'Aling Nena', wallet: vendorWallet },
      totals: { totalXlm: 2, transactionCount: 1 },
    });
  });
});

describe('buildCollectionsSummary', () => {
  it('summarizes active, completed, overdue, defaulted, outstanding, and collected utang values', () => {
    const now = new Date('2026-05-14T00:00:00.000Z');
    const summary = buildCollectionsSummary([
      utang({ id: 1n, status: 'active', totalAmountXlm: 12, installmentAmountXlm: 4, installmentsPaid: 1, nextDueSecs: 1_700_000_000n }),
      utang({ id: 2n, status: 'completed', totalAmountXlm: 9, installmentAmountXlm: 3, installmentsPaid: 3 }),
      utang({ id: 3n, status: 'defaulted', totalAmountXlm: 10, installmentAmountXlm: 5, installmentsPaid: 1 }),
    ], now);

    expect(summary.activeAgreements).toBe(1);
    expect(summary.completedAgreements).toBe(1);
    expect(summary.defaultedAgreements).toBe(1);
    expect(summary.overdueAgreements).toBe(1);
    expect(summary.totalOutstandingXlm).toBe(13);
    expect(summary.totalCollectedXlm).toBe(18);
    expect(summary.sourceLabel).toBe('UtangEscrow records');
  });
});
