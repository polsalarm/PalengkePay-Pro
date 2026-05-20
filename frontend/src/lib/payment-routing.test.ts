import { describe, expect, it } from 'vitest';
import { resolvePaymentSettlementMode, xlmToStroops } from './payment-routing';

describe('resolvePaymentSettlementMode', () => {
  it('uses contract settlement when the PalengkePayment contract id is configured', () => {
    expect(resolvePaymentSettlementMode('CCVHL724CBAKIBEM2BMWUV35FXXV2TESWC3ZK3UQVLUEGCQ7LNN6ZUNF'))
      .toBe('contract');
  });

  it('falls back to fee-bumped Stellar transfers when no contract id is configured', () => {
    expect(resolvePaymentSettlementMode(undefined)).toBe('fee-bump');
    expect(resolvePaymentSettlementMode('')).toBe('fee-bump');
  });
});

describe('xlmToStroops', () => {
  it('converts XLM decimals to exact stroops', () => {
    expect(xlmToStroops('1')).toBe(10_000_000n);
    expect(xlmToStroops('1.25')).toBe(12_500_000n);
    expect(xlmToStroops('0.0000001')).toBe(1n);
  });

  it('rejects invalid or non-positive amounts', () => {
    expect(() => xlmToStroops('0')).toThrow('amount must be greater than 0');
    expect(() => xlmToStroops('-1')).toThrow('amount must be greater than 0');
    expect(() => xlmToStroops('abc')).toThrow('amount must be a valid XLM value');
    expect(() => xlmToStroops('1.00000001')).toThrow('amount supports at most 7 decimal places');
  });
});
