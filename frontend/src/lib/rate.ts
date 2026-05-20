/**
 * XLM → PHP exchange rate fetcher.
 *
 * Source: CoinGecko public API (no auth, free tier).
 * Cached in localStorage with TTL to limit API calls.
 */

const CACHE_KEY = 'pp_xlm_php_rate';
const TTL_MS = 5 * 60 * 1000; // 5 minutes
const FALLBACK_RATE = 22; // PHP per 1 XLM — sane default when API unreachable

interface CachedRate {
  rate: number;
  fetchedAt: number;
}

interface CoinGeckoResponse {
  stellar?: { php?: number };
}

export interface RateState {
  rate: number;
  fetchedAt: Date | null;
  isFresh: boolean;
}

function readCache(): CachedRate | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedRate;
  } catch {
    return null;
  }
}

function writeCache(rate: number) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ rate, fetchedAt: Date.now() } satisfies CachedRate));
  } catch { /* quota — skip */ }
}

export function getCachedRate(): RateState {
  const cached = readCache();
  if (!cached) return { rate: FALLBACK_RATE, fetchedAt: null, isFresh: false };
  const age = Date.now() - cached.fetchedAt;
  return {
    rate: cached.rate,
    fetchedAt: new Date(cached.fetchedAt),
    isFresh: age < TTL_MS,
  };
}

export async function fetchPhpRate(): Promise<RateState> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=php',
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const data = (await res.json()) as CoinGeckoResponse;
    const rate = data.stellar?.php;
    if (typeof rate !== 'number' || rate <= 0) throw new Error('Invalid rate');
    writeCache(rate);
    return { rate, fetchedAt: new Date(), isFresh: true };
  } catch {
    // Network/API failure → fall back to cache or constant
    return getCachedRate();
  }
}

export function xlmToPhp(xlm: number, rate: number): number {
  return xlm * rate;
}

export function formatPhp(value: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatXlm(value: number, digits = 2): string {
  return value.toFixed(digits);
}
