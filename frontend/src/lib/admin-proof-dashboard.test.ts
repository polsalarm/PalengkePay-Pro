import { describe, expect, it } from 'vitest';
import type { PaymentProofRecord } from './payment-proof';
import type { PaymentHistoryRecord } from './payment-source';
import { buildAdminProofDashboard } from './admin-proof-dashboard';

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

const payment = (overrides: Partial<PaymentHistoryRecord>): PaymentHistoryRecord => ({
  id: 'palengke-payment:1',
  paymentId: 1,
  from: proof.from,
  to: proof.to,
  amountXlm: 20,
  createdAt: proof.createdAt,
  memo: proof.memo,
  source: 'palengke-payment',
  txHash: proof.txHash,
  quote: proof.quote,
  ...overrides,
});

describe('buildAdminProofDashboard', () => {
  it('summarizes recent receipts, source mix, sponsor readiness, and failure diagnostics', () => {
    const dashboard = buildAdminProofDashboard({
      proofs: [proof],
      payments: [
        payment({ id: 'contract', source: 'palengke-payment' }),
        payment({ id: 'fallback', source: 'fee-bump', txHash: 'fallback-hash' }),
      ],
      healthChecks: [
        { name: 'sponsor_rate_limit', ok: true, status: 200, detail: 'durable Redis REST configured' },
      ],
      paymentErrors: ['Too many fee-bump requests'],
    });

    expect(dashboard.recentReceipts[0]).toMatchObject({
      txHash: 'tx-live-hash',
      phpAmount: 125,
      xlmAmount: 20,
    });
    expect(dashboard.sourceMix).toEqual({
      contractRecords: 1,
      horizonFallback: 1,
      mixedUnverified: 1,
      totalRows: 2,
    });
    expect(dashboard.sponsorStatus).toMatchObject({
      label: 'Durable limiter healthy',
      severity: 'ok',
    });
    expect(dashboard.failedPaymentDiagnostics[0]).toMatchObject({
      title: 'Sponsor rate limit',
      severity: 'warning',
    });
  });

  it('flags missing production sponsor readiness without exposing secret values', () => {
    const dashboard = buildAdminProofDashboard({
      proofs: [],
      payments: [],
      healthChecks: [
        { name: 'sponsor_rate_limit', ok: false, status: 503, detail: 'durable Redis REST rate limiting is required' },
      ],
    });

    expect(dashboard.sponsorStatus.label).toBe('Sponsor limiter degraded');
    expect(dashboard.sponsorStatus.severity).toBe('danger');
    expect(JSON.stringify(dashboard)).not.toContain('TOKEN');
  });
});
