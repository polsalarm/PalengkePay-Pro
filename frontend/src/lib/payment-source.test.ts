import { describe, expect, it } from 'vitest';
import {
  buildPaymentMetrics,
  mergePaymentHistory,
  normalizeContractPayment,
  normalizeFallbackPayment,
  type MetricVendor,
} from './payment-source';
import type { IndexedPayment } from './indexer';

const vendorA = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const vendorB = 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const customerA = 'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';

const vendors: MetricVendor[] = [
  {
    wallet: vendorA,
    name: 'Maria Fish',
    stallNumber: '12',
    productType: 'fish',
    isActive: true,
  },
  {
    wallet: vendorB,
    name: 'Ana Veg',
    stallNumber: '8',
    productType: 'vegetables',
    isActive: true,
  },
];

describe('normalizeContractPayment', () => {
  it('normalizes PalengkePayment contract records into history rows', () => {
    expect(normalizeContractPayment({
      id: 4n,
      customer: customerA,
      vendor: vendorA,
      amount: 12_500_000n,
      timestamp: 1_768_600_000n,
      memo: 'tilapia',
    })).toEqual({
      id: 'palengke-payment:4',
      paymentId: 4,
      from: customerA,
      to: vendorA,
      amountXlm: 1.25,
      createdAt: '2026-01-16T21:46:40.000Z',
      memo: 'tilapia',
      source: 'palengke-payment',
    });
  });
});

describe('buildPaymentMetrics', () => {
  it('builds admin metrics from canonical payment records while preserving vendor category counts', () => {
    const metrics = buildPaymentMetrics(vendors, [
      normalizeContractPayment({ id: 1, customer: customerA, vendor: vendorA, amount: 20_000_000n, timestamp: 1, memo: 'fish' }),
      normalizeContractPayment({ id: 2, customer: customerA, vendor: vendorA, amount: 10_000_000n, timestamp: 2, memo: 'more fish' }),
      normalizeContractPayment({ id: 3, customer: customerA, vendor: vendorB, amount: 5_000_000n, timestamp: 3, memo: 'veg' }),
    ], 1);

    expect(metrics.summary).toEqual({
      totalVendors: 2,
      activeVendors: 2,
      pendingVendors: 1,
      totalVolumeXlm: 3.5,
      totalTransactions: 3,
      avgTxXlm: 1.1666667,
    });
    expect(metrics.productBreakdown).toContainEqual({
      type: 'fish',
      count: 1,
      volumeXlm: 3,
      pct: 50,
    });
    expect(metrics.topVendors[0]).toMatchObject({
      wallet: vendorA,
      name: 'Maria Fish',
      totalTransactions: 2,
      volumeXlm: 3,
    });
  });
});

describe('mergePaymentHistory', () => {
  it('prefers canonical contract records over matching fallback Horizon records', () => {
    const contract = normalizeContractPayment({
      id: 1,
      customer: customerA,
      vendor: vendorA,
      amount: 10_000_000n,
      timestamp: 1_700_000_000n,
      memo: 'PP:test',
    });
    const fallback = normalizeFallbackPayment({
      id: 'horizon-1',
      from: customerA,
      to: vendorA,
      amountXlm: 1,
      createdAt: '2023-11-14T22:13:20.000Z',
      memo: 'PP:test',
    } satisfies IndexedPayment);

    expect(mergePaymentHistory([contract], [fallback])).toEqual([contract]);
  });
});
