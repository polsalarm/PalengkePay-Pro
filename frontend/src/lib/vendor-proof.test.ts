import { describe, expect, it } from 'vitest';
import type { PaymentHistoryRecord } from './payment-source';
import type { UtangRecord } from './hooks/useUtang';
import {
  buildCollectionsSummary,
  buildIncomeProofCertificate,
  buildProofBundle,
  buildProofSummary,
  filterTransactionsBySearch,
  filterTransactionsByPeriod,
  toCertificateText,
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

  it('builds a lender-friendly certificate summary from the proof pack', () => {
    const summary = buildProofSummary({
      vendor: { name: 'Aling Nena', wallet: vendorWallet, stallNumber: 'A-12', productType: 'gulay' },
      transactions: [
        tx({
          id: 'row-1',
          txHash: 'tx-live-hash',
          amountXlm: 20,
          quote: {
            phpAmount: 125,
            phpPerXlm: 6.25,
            xlmAmount: '20.0000000',
            generatedAt: '2026-05-14T01:00:00.000Z',
            expiresAt: '2026-05-14T01:01:00.000Z',
            source: 'api',
          },
        }),
      ],
      period: { kind: '30d', label: '30 days' },
      generatedAt: '2026-05-14T04:00:00.000Z',
    });

    expect(buildIncomeProofCertificate(summary)).toMatchObject({
      title: 'PalengkePay Income Proof Certificate',
      audience: 'Prepared for lender, cooperative, LGU, or aid-program review.',
      vendorLine: 'Aling Nena · Stall A-12 · gulay',
      reviewStatus: 'Ready for review',
      highlights: [
        { label: 'Transactions', value: '1' },
        { label: 'Total XLM', value: '20.00 XLM' },
        { label: 'PHP estimate', value: 'PHP 125.00' },
        { label: 'Source', value: 'Contract records' },
        { label: 'Live hash', value: 'tx-live-hash' },
      ],
    });
  });
});

describe('filterTransactionsBySearch', () => {
  it('matches transaction hash, customer wallet, memo, source, and amount', () => {
    const rows = [
      tx({ id: 'contract-row', txHash: 'hash-contract', from: customerA, memo: 'gulay', amountXlm: 12, source: 'palengke-payment' }),
      tx({ id: 'fallback-row', txHash: 'hash-fallback', from: customerB, memo: 'isda', amountXlm: 4.25, source: 'fee-bump' }),
    ];

    expect(filterTransactionsBySearch(rows, 'hash-fallback').map((payment) => payment.id)).toEqual(['fallback-row']);
    expect(filterTransactionsBySearch(rows, customerA.slice(0, 12)).map((payment) => payment.id)).toEqual(['contract-row']);
    expect(filterTransactionsBySearch(rows, 'isda').map((payment) => payment.id)).toEqual(['fallback-row']);
    expect(filterTransactionsBySearch(rows, 'fee-bump').map((payment) => payment.id)).toEqual(['fallback-row']);
    expect(filterTransactionsBySearch(rows, '12.00').map((payment) => payment.id)).toEqual(['contract-row']);
    expect(filterTransactionsBySearch(rows, '  ').map((payment) => payment.id)).toEqual(['contract-row', 'fallback-row']);
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
        tx({ id: 'fallback', source: 'fee-bump' }),
      ],
      period: { kind: 'all', label: 'All time' },
      generatedAt: '2026-05-14T04:00:00.000Z',
    });

    expect(summary.sourceLabel).toBe('Mixed/unverified records');
    expect(summary.hasFallbackCaveat).toBe(true);
    expect(summary.caveats).toContain('Includes Horizon/cache fallback rows; fallback rows are not the canonical payment contract source.');
    expect(summary.caveats).toContain('Live wallet-signed payment smoke is not attached to this export.');
  });

  it('treats preserved row transaction hashes as attached live proof', () => {
    const summary = buildProofSummary({
      vendor: { name: 'Vendor', wallet: vendorWallet },
      transactions: [
        tx({ id: 'contract', source: 'palengke-payment', txHash: 'tx-live-hash' }),
      ],
      period: { kind: 'all', label: 'All time' },
      generatedAt: '2026-05-14T04:00:00.000Z',
    });

    expect(summary.readiness.label).toBe('Ready for review');
    expect(summary.readiness.liveProofMissing).toBe(false);
    expect(summary.livePaymentTxHash).toBe('tx-live-hash');
    expect(summary.caveats).not.toContain('Live wallet-signed payment smoke is not attached to this export.');
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

    expect(toProofCsv(summary)).toContain('date,amount_xlm,php_amount,php_per_xlm,memo,customer_wallet,receipt_reference_type,receipt_reference,receipt_lookup_url,source');
    expect(toProofCsv(summary)).toContain('2026-05-10T00:00:00.000Z,3.2500000,,,gulay,GCUSTO...0000,Transaction hash,hash-1,https://stellar.expert/explorer/testnet/tx/hash-1,Contract records');
  });

  it('creates a JSON proof bundle with generated metadata, caveats, and certificate data', () => {
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
      certificate: {
        title: 'PalengkePay Income Proof Certificate',
        vendorLine: 'Aling Nena',
        reviewStatus: 'Needs live proof',
      },
      transactions: [
        {
          receiptReference: {
            label: 'Contract payment ID',
            value: '#1',
            lookupUrl: null,
          },
        },
      ],
    });
  });

  it('creates a standalone certificate text packet for lender review', () => {
    const summary = buildProofSummary({
      vendor: { name: 'Aling Nena', wallet: vendorWallet, stallNumber: 'A-12', productType: 'gulay' },
      transactions: [
        tx({
          id: 'row-1',
          txHash: 'tx-live-hash',
          amountXlm: 20,
          quote: {
            phpAmount: 125,
            phpPerXlm: 6.25,
            xlmAmount: '20.0000000',
            generatedAt: '2026-05-14T01:00:00.000Z',
            expiresAt: '2026-05-14T01:01:00.000Z',
            source: 'api',
          },
        }),
      ],
      period: { kind: '30d', label: '30 days' },
      generatedAt: '2026-05-14T04:00:00.000Z',
    });

    expect(toCertificateText(summary)).toContain('PalengkePay Income Proof Certificate');
    expect(toCertificateText(summary)).toContain('Vendor: Aling Nena · Stall A-12 · gulay');
    expect(toCertificateText(summary)).toContain('Transactions: 1');
    expect(toCertificateText(summary)).toContain('PHP estimate: PHP 125.00');
    expect(toCertificateText(summary)).toContain('Includes at least one wallet-signed Testnet transaction reference for review.');
    expect(toCertificateText(summary)).toContain('Live Testnet hash: tx-live-hash');
    expect(toCertificateText(summary)).toContain('Verification notes:');
  });

  it('includes a concrete generated date range and optional PHP estimate', () => {
    const summary = buildProofSummary({
      vendor: { name: 'Aling Nena', wallet: vendorWallet },
      transactions: [
        tx({ id: 'newer', amountXlm: 2, createdAt: '2026-05-12T08:30:00.000Z' }),
        tx({ id: 'older', amountXlm: 3, createdAt: '2026-05-10T01:15:00.000Z' }),
      ],
      period: { kind: '7d', label: '7 days' },
      generatedAt: '2026-05-14T04:00:00.000Z',
      phpPerXlm: 6.5,
    });

    expect(summary.dateRange).toEqual({
      from: '2026-05-10T01:15:00.000Z',
      to: '2026-05-12T08:30:00.000Z',
      label: 'May 10, 2026 - May 12, 2026',
    });
    expect(summary.estimatedPhpTotal).toBe(32.5);
    expect(buildProofBundle(summary)).toMatchObject({
      period: { kind: '7d', label: '7 days' },
      dateRange: { label: 'May 10, 2026 - May 12, 2026' },
      totals: { estimatedPhpTotal: 32.5 },
    });
  });

  it('uses preserved row-level PHP quote data for proof totals and exports', () => {
    const summary = buildProofSummary({
      vendor: { name: 'Aling Nena', wallet: vendorWallet },
      transactions: [
        tx({
          id: 'row-1',
          txHash: 'tx-live-hash',
          amountXlm: 20,
          quote: {
            phpAmount: 125,
            phpPerXlm: 6.25,
            xlmAmount: '20.0000000',
            generatedAt: '2026-05-14T01:00:00.000Z',
            expiresAt: '2026-05-14T01:01:00.000Z',
            source: 'api',
          },
        }),
      ],
      period: { kind: 'all', label: 'All' },
      generatedAt: '2026-05-14T04:00:00.000Z',
      livePaymentTxHash: 'tx-live-hash',
    });

    expect(summary.estimatedPhpTotal).toBe(125);
    expect(summary.readiness.liveProofMissing).toBe(false);
    expect(toProofCsv(summary)).toContain('date,amount_xlm,php_amount,php_per_xlm,memo,customer_wallet,receipt_reference_type,receipt_reference,receipt_lookup_url,source');
    expect(toProofCsv(summary)).toContain('2026-05-10T00:00:00.000Z,20.0000000,125.00,6.2500,gulay,GCUSTO...0000,Transaction hash,tx-live-hash,https://stellar.expert/explorer/testnet/tx/tx-live-hash,Contract records');
    expect(buildProofBundle(summary)).toMatchObject({
      livePaymentTxHash: 'tx-live-hash',
      totals: { estimatedPhpTotal: 125 },
      certificate: {
        highlights: [
          { label: 'Transactions', value: '1' },
          { label: 'Total XLM', value: '20.00 XLM' },
          { label: 'PHP estimate', value: 'PHP 125.00' },
          { label: 'Source', value: 'Contract records' },
          { label: 'Live hash', value: 'tx-live-hash' },
        ],
      },
      transactions: [
        {
          txHash: 'tx-live-hash',
          quote: { phpAmount: 125, phpPerXlm: 6.25, source: 'api' },
          receiptReference: {
            label: 'Transaction hash',
            value: 'tx-live-hash',
          },
        },
      ],
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
