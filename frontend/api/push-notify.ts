import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fanout } from './_pushFanout.js';
import { isValidWallet, sanitizePayload } from './_pushValidation.js';

/**
 * Fan out a push notification to every subscription registered under a Stellar wallet.
 *
 * Body: { wallet: string, payload: { title, body, icon?, tag?, url? } }
 *
 * Triggered from the client at payment success (notify vendor) and at utang accept
 * (notify vendor). Subscriptions returning 404 / 410 are pruned from the store.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { wallet, payload } = (req.body ?? {}) as {
    wallet?: string;
    payload?: { title?: string; body?: string; icon?: string; tag?: string; url?: string };
  };

  if (!isValidWallet(wallet)) {
    return res.status(400).json({ error: 'valid Stellar wallet required (G..., 56 chars)' });
  }

  try {
    const result = await fanout(wallet, sanitizePayload(payload));
    return res.status(200).json({ ok: true, ...result });
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as { message?: string }).message ?? 'fanout failed' });
  }
}
