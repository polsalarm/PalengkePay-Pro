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
    });
    expect(isQuoteExpired(quote, Date.UTC(2026, 4, 13, 10, 0, 59))).toBe(false);
    expect(isQuoteExpired(quote, Date.UTC(2026, 4, 13, 10, 1, 0))).toBe(true);
  });

  it('rejects invalid checkout amounts and rates', () => {
    expect(() => buildStableCheckoutQuote({ phpAmount: '0', phpPerXlm: 8.4 })).toThrow('PHP amount must be greater than 0');
    expect(() => buildStableCheckoutQuote({ phpAmount: '100', phpPerXlm: 0 })).toThrow('quote rate must be greater than 0');
  });
});

describe('quote formatting', () => {
  it('formats receipt amounts consistently', () => {
    expect(formatPhp(420)).toBe('₱420.00');
    expect(formatXlm('50.0000000')).toBe('50 XLM');
    expect(formatXlm('0.1234567')).toBe('0.1234567 XLM');
  });
});
