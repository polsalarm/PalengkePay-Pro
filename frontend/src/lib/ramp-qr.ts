import type { CashinQuoteResult } from './ramp';

export interface CashinQrPayload {
  type: 'palengkepay.ramp.cashin';
  id: string;
  proofReference: string;
  amountPhp: string;
  rail: string;
  expiresAt: number;
  network: 'testnet' | 'mainnet';
}

export function buildCashinQrPayload(quote: CashinQuoteResult, network: 'testnet' | 'mainnet' = 'testnet'): CashinQrPayload {
  return {
    type: 'palengkepay.ramp.cashin',
    id: quote.id,
    proofReference: quote.proofReference ?? quote.instructions.reference,
    amountPhp: quote.amountPhp,
    rail: quote.instructions.rail,
    expiresAt: quote.expiresAt,
    network,
  };
}

export function encodeCashinQrPayload(payload: CashinQrPayload): string {
  return JSON.stringify(payload);
}

export function quoteSecondsRemaining(expiresAt: number, nowMs = Date.now()): number {
  return Math.max(0, Math.ceil((expiresAt - nowMs) / 1000));
}
