import type { VercelRequest, VercelResponse } from '@vercel/node';

const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=php';
const CACHE_MS = 30_000;
const QUOTE_TTL_MS = 60_000;

interface CachedQuote {
  phpPerXlm: number;
  fetchedAtMs: number;
}

let cachedQuote: CachedQuote | null = null;

async function fetchPhpPerXlm(): Promise<number> {
  const response = await fetch(COINGECKO_URL, {
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`quote provider returned ${response.status}`);
  }

  const body = await response.json() as { stellar?: { php?: unknown } };
  const phpPerXlm = Number(body.stellar?.php);
  if (!Number.isFinite(phpPerXlm) || phpPerXlm <= 0) {
    throw new Error('quote provider returned an invalid rate');
  }

  return phpPerXlm;
}

export async function getStableCheckoutRate(nowMs = Date.now()): Promise<CachedQuote> {
  if (cachedQuote && nowMs - cachedQuote.fetchedAtMs < CACHE_MS) {
    return cachedQuote;
  }

  cachedQuote = {
    phpPerXlm: await fetchPhpPerXlm(),
    fetchedAtMs: nowMs,
  };
  return cachedQuote;
}

export function __resetStableCheckoutQuoteCacheForTests(): void {
  cachedQuote = null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const nowMs = Date.now();
    const quote = await getStableCheckoutRate(nowMs);
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return res.status(200).json({
      phpPerXlm: quote.phpPerXlm,
      source: 'coingecko',
      fetchedAt: new Date(quote.fetchedAtMs).toISOString(),
      expiresAt: new Date(nowMs + QUOTE_TTL_MS).toISOString(),
    });
  } catch (error: unknown) {
    return res.status(502).json({
      error: (error as { message?: string }).message ?? 'Quote unavailable',
    });
  }
}
