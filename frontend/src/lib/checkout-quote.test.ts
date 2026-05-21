import { describe, expect, it } from 'vitest';
import {
  buildStableCheckoutQuote,
  formatPhp,
  formatXlm,
  isQuoteExpired,
} from './checkout-quote';

describe('buildStableCheckoutQuote', () => {
  it('locks a PHP-first checkout quote for a fixed expiry window', () => {
    const quote = buildStableCheckoutQuote({
      phpAmount: '420',
      phpPerXlm: 8.4,
      nowMs: Date.UTC(2026, 4, 13, 10, 0, 0),
    });

    expect(quote).toEqual({
      phpAmount: 420,
      phpPerXlm: 8.4,
      xlmAmount: '50.0000000',
      generatedAt: '2026-05-13T10:00:00.000Z',
      expiresAt: '2026-05-13T10:01:00.000Z',
      source: 'fallback',
    });
    expect(isQuoteExpired(quote, Date.UTC(2026, 4, 13, 10, 0, 59))).toBe(false);
    expect(isQuoteExpired(quote, Date.UTC(2026, 4, 13, 10, 1, 0))).toBe(true);
  });

  it('rejects invalid checkout amounts and rates', () => {
    expect(() => buildStableCheckoutQuote({ phpAmount: '0', phpPerXlm: 8.4 })).toThrow('PHP amount must be greater than 0');
    expect(() => buildStableCheckoutQuote({ phpAmount: '100', phpPerXlm: 0 })).toThrow('quote rate must be greater than 0');
  });

  it('preserves the verified quote source for receipts and proof exports', () => {
    expect(buildStableCheckoutQuote({
      phpAmount: '125',
      phpPerXlm: 6.25,
      source: 'api',
      nowMs: Date.UTC(2026, 4, 14, 1, 0, 0),
    })).toMatchObject({
      phpAmount: 125,
      phpPerXlm: 6.25,
      xlmAmount: '20.0000000',
      source: 'api',
    });
  });
});

describe('quote formatting', () => {
  it('formats receipt amounts consistently', () => {
    expect(formatPhp(420)).toBe('₱420.00');
    expect(formatXlm('50.0000000')).toBe('50 XLM');
    expect(formatXlm('0.1234567')).toBe('0.1234567 XLM');
  });
});
