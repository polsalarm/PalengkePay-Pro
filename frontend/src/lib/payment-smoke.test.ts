import { describe, expect, it } from 'vitest';
import type { PaymentProofRecord } from './payment-proof';
import { buildTestnetPaymentSmokeGuide } from './payment-smoke';

const proof: PaymentProofRecord = {
  txHash: 'tx-live-hash',
  from: 'GCUSTOMER000000000000000000000000000000000000000000000',
  to: 'GVENDOR00000000000000000000000000000000000000000000000',
  amountXlm: 20,
  createdAt: '2026-05-14T01:00:30.000Z',
  memo: 'E2E smoke',
  settlementMode: 'contract',
  quote: {
    phpAmount: 125,
    phpPerXlm: 6.25,
    xlmAmount: '20.0000000',
    generatedAt: '2026-05-14T01:00:00.000Z',
    expiresAt: '2026-05-14T01:01:00.000Z',
    source: 'api',
  },
};

describe('buildTestnetPaymentSmokeGuide', () => {
  it('guides the operator until a real wallet-signed hash is captured', () => {
    const guide = buildTestnetPaymentSmokeGuide([]);

    expect(guide.status).toBe('needs_hash');
    expect(guide.capturedHash).toBeNull();
    expect(guide.steps.map((step) => [step.id, step.status])).toEqual([
      ['connect-funded-wallet', 'todo'],
      ['make-testnet-payment', 'todo'],
      ['customer-history-proof', 'blocked'],
      ['receipt-page-proof', 'blocked'],
      ['vendor-export-proof', 'blocked'],
    ]);
  });

  it('marks customer history, receipt page, and vendor proof as ready when a proof hash exists', () => {
    const guide = buildTestnetPaymentSmokeGuide([proof]);

    expect(guide.status).toBe('ready');
    expect(guide.capturedHash).toBe('tx-live-hash');
    expect(guide.stellarExpertUrl).toBe('https://stellar.expert/explorer/testnet/tx/tx-live-hash');
    expect(guide.steps.every((step) => step.status === 'done')).toBe(true);
  });
});
