import { describe, expect, it } from 'vitest';
import type { PaymentHistoryRecord } from './payment-source';
import {
  enrichPaymentHistoryWithProofs,
  getPaymentProofByHash,
  getPaymentProofs,
  savePaymentProof,
} from './payment-proof';

const customerWallet = 'GCUSTOMER000000000000000000000000000000000000000000000';
const vendorWallet = 'GVENDOR00000000000000000000000000000000000000000000000';

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

function payment(overrides: Partial<PaymentHistoryRecord> = {}): PaymentHistoryRecord {
  return {
    id: 'palengke-payment:1',
    paymentId: 1,
    from: customerWallet,
    to: vendorWallet,
    amountXlm: 20,
    createdAt: '2026-05-14T01:00:30.000Z',
    memo: 'E2E smoke',
    source: 'palengke-payment',
    ...overrides,
  };
}

describe('payment proof persistence', () => {
  it('stores a signed payment hash and quote for both customer and vendor history', () => {
    const storage = createMemoryStorage();

    savePaymentProof({
      txHash: 'tx-live-hash',
      from: customerWallet,
      to: vendorWallet,
      amountXlm: 20,
      memo: 'E2E smoke',
      createdAt: '2026-05-14T01:00:31.000Z',
      settlementMode: 'contract',
      quote: {
        phpAmount: 125,
        phpPerXlm: 6.25,
        xlmAmount: '20.0000000',
        generatedAt: '2026-05-14T01:00:00.000Z',
        expiresAt: '2026-05-14T01:01:00.000Z',
        source: 'api',
      },
    }, storage);

    expect(getPaymentProofs(customerWallet, storage)).toHaveLength(1);
    expect(getPaymentProofs(vendorWallet, storage)).toHaveLength(1);

    expect(enrichPaymentHistoryWithProofs([payment()], vendorWallet, storage)).toEqual([
      {
        ...payment(),
        txHash: 'tx-live-hash',
        quote: {
          phpAmount: 125,
          phpPerXlm: 6.25,
          xlmAmount: '20.0000000',
          generatedAt: '2026-05-14T01:00:00.000Z',
          expiresAt: '2026-05-14T01:01:00.000Z',
          source: 'api',
        },
      },
    ]);

    expect(getPaymentProofByHash('tx-live-hash', storage)).toMatchObject({
      txHash: 'tx-live-hash',
      from: customerWallet,
      to: vendorWallet,
      quote: { phpAmount: 125, source: 'api' },
    });
  });
});
