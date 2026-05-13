export const QUOTE_TTL_MS = 60_000;

export interface StableCheckoutQuote {
  phpAmount: number;
  phpPerXlm: number;
  xlmAmount: string;
  generatedAt: string;
  expiresAt: string;
}

interface BuildQuoteInput {
  phpAmount: string;
  phpPerXlm: number;
  nowMs?: number;
}

export function buildStableCheckoutQuote({ phpAmount, phpPerXlm, nowMs = Date.now() }: BuildQuoteInput): StableCheckoutQuote {
  const parsedPhp = Number(phpAmount);
  if (!Number.isFinite(parsedPhp) || parsedPhp <= 0) {
    throw new Error('PHP amount must be greater than 0');
  }
  if (!Number.isFinite(phpPerXlm) || phpPerXlm <= 0) {
    throw new Error('quote rate must be greater than 0');
  }

  return {
    phpAmount: parsedPhp,
    phpPerXlm,
    xlmAmount: (parsedPhp / phpPerXlm).toFixed(7),
    generatedAt: new Date(nowMs).toISOString(),
    expiresAt: new Date(nowMs + QUOTE_TTL_MS).toISOString(),
  };
}

export function isQuoteExpired(quote: StableCheckoutQuote, nowMs = Date.now()): boolean {
  return nowMs >= new Date(quote.expiresAt).getTime();
}

export function quoteSecondsRemaining(quote: StableCheckoutQuote, nowMs = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(quote.expiresAt).getTime() - nowMs) / 1000));
}

export function formatPhp(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatXlm(amount: string | number): string {
  const asNumber = Number(amount);
  const formatted = Number.isFinite(asNumber)
    ? asNumber.toLocaleString('en-US', { maximumFractionDigits: 7 })
    : String(amount);
  return `${formatted} XLM`;
}
