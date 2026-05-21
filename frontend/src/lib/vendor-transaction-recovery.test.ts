import { describe, expect, it } from 'vitest';
import type { PaymentHistoryRecord } from './payment-source';
import {
  buildVendorRecoverySummary,
  getTransactionReceiptReference,
  lookupTransactionReceipt,
} from './vendor-transaction-recovery';

const vendorWallet = 'GVENDOR000000000000000000000000000000000000000000000000';
const customerWallet = 'GCUSTOMERA0000000000000000000000000000000000000000000000';

function tx(overrides: Partial<PaymentHistoryRecord>): PaymentHistoryRecord {
  return {
    id: 'palengke-payment:1',
    paymentId: 1,
    from: customerWallet,
    to: vendorWallet,
    amountXlm: 4,
    createdAt: '2026-05-14T01:00:00.000Z',
    memo: 'gulay',
    source: 'palengke-payment',
    ...overrides,
  };
}

describe('getTransactionReceiptReference', () => {
  it('prefers transaction hash receipt lookup links when available', () => {
    expect(getTransactionReceiptReference(tx({ txHash: 'abc123' }))).toEqual({
      label: 'Transaction hash',
      value: 'abc123',
      lookupUrl: 'https://stellar.expert/explorer/testnet/tx/abc123',
      detail: 'Open Stellar Expert to verify the submitted transaction.',
    });
  });

  it('falls back to the contract payment identity when no hash is attached', () => {
    expect(getTransactionReceiptReference(tx({ paymentId: 42, txHash: undefined }))).toEqual({
      label: 'Contract payment ID',
      value: '#42',
      lookupUrl: null,
      detail: 'Use this PalengkePayment record ID when reconciling contract history.',
    });
  });
});

describe('buildVendorRecoverySummary', () => {
  it('summarizes receipt lookup and resend paths for mixed vendor history', () => {
    const summary = buildVendorRecoverySummary([
      tx({ id: 'contract', source: 'palengke-payment', paymentId: 9 }),
      tx({ id: 'fallback', source: 'fee-bump', txHash: 'fallback-hash' }),
    ]);

    expect(summary.receiptLookup.availableCount).toBe(2);
    expect(summary.receiptLookup.latestReference).toBe('fallback-hash');
    expect(summary.resend.title).toBe('Need the customer to resend?');
    expect(summary.resend.actionLabel).toBe('Share QR again');
    expect(summary.resend.actionPath).toBe('/vendor/qr');
    expect(summary.feeBumpDiagnostic.title).toBe('Fee-bump records need receipt confirmation');
    expect(summary.feeBumpDiagnostic.detail).toContain('Horizon/cache fallback');
  });

  it('turns failed sponsor messages into vendor-safe diagnostics', () => {
    const summary = buildVendorRecoverySummary([], 'Too many fee-bump requests');

    expect(summary.feeBumpDiagnostic.title).toBe('Sponsor rate limit');
    expect(summary.feeBumpDiagnostic.detail).toContain('wait');
    expect(summary.feeBumpDiagnostic.actionLabel).toBe('Share QR for retry');
  });

  it('surfaces missing sponsor setup without implying funds moved', () => {
    const summary = buildVendorRecoverySummary([], 'Fee bump sponsor not configured');

    expect(summary.feeBumpDiagnostic.title).toBe('Sponsor not configured');
    expect(summary.feeBumpDiagnostic.detail).toContain('No vendor funds are confirmed');
  });

  it('surfaces durable limiter outages as a production fail-closed diagnostic', () => {
    const summary = buildVendorRecoverySummary([], 'Durable fee-bump rate limit not configured');

    expect(summary.feeBumpDiagnostic.title).toBe('Sponsor limiter unavailable');
    expect(summary.feeBumpDiagnostic.detail).toContain('fail closed');
    expect(summary.feeBumpDiagnostic.actionLabel).toBe('Verify Redis/KV env');
  });
});

describe('lookupTransactionReceipt', () => {
  it('finds a receipt by hash, contract payment id, or fallback reference', () => {
    const rows = [
      tx({ id: 'palengke-payment:42', paymentId: 42, txHash: undefined }),
      tx({ id: 'fallback-row', source: 'fee-bump', txHash: 'fallback-hash' }),
    ];

    expect(lookupTransactionReceipt(rows, 'fallback-hash')).toMatchObject({
      status: 'found',
      reference: { value: 'fallback-hash', label: 'Transaction hash' },
    });
    expect(lookupTransactionReceipt(rows, '#42')).toMatchObject({
      status: 'found',
      reference: { value: '#42', label: 'Contract payment ID' },
    });
    expect(lookupTransactionReceipt(rows, 'fallback-row')).toMatchObject({
      status: 'found',
      reference: { value: 'fallback-hash' },
    });
  });

  it('returns operator-safe empty and missing states', () => {
    expect(lookupTransactionReceipt([], '')).toMatchObject({
      status: 'empty',
      message: 'Enter a transaction hash, contract payment ID, or local receipt reference.',
    });
    expect(lookupTransactionReceipt([], 'missing')).toMatchObject({
      status: 'not_found',
      message: 'No local receipt matched that reference. Ask the customer for the hash, then refresh history.',
    });
  });
});
