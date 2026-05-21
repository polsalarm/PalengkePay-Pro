import { describe, expect, it } from 'vitest';
import { buildCashinQrPayload, encodeCashinQrPayload, quoteSecondsRemaining } from './ramp-qr';
import type { CashinQuoteResult } from './ramp';

const quote: CashinQuoteResult = {
  id: 'rmp_test123',
  amountPhp: '150.00',
  amountXlm: '19.1083',
  rate: '7.85',
  feePhp: '3.00',
  spreadBps: 85,
  railProvider: 'PDAX_STYLE',
  railMode: 'mock',
  proofReference: 'RMP-TEST123',
  expiresAt: Date.UTC(2026, 4, 21, 8, 1, 0),
  instructions: {
    rail: 'GCash / QR Ph settlement rail',
    reference: 'RMP-TEST123',
  },
};

describe('cash-in QR payload', () => {
  it('encodes the reference package judges can inspect', () => {
    const payload = buildCashinQrPayload(quote, 'testnet');
    const encoded = encodeCashinQrPayload(payload);

    expect(JSON.parse(encoded)).toEqual({
      type: 'palengkepay.ramp.cashin',
      id: 'rmp_test123',
      proofReference: 'RMP-TEST123',
      amountPhp: '150.00',
      rail: 'GCash / QR Ph settlement rail',
      expiresAt: Date.UTC(2026, 4, 21, 8, 1, 0),
      network: 'testnet',
    });
  });

  it('calculates countdown seconds without going negative', () => {
    expect(quoteSecondsRemaining(10_000, 1_000)).toBe(9);
    expect(quoteSecondsRemaining(10_000, 10_500)).toBe(0);
  });
});
