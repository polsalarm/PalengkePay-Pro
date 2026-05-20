import type { VercelRequest, VercelResponse } from '@vercel/node';
import { addSubscription, isPersistent } from './_pushStore.js';
import { hasServerVapid, isValidSubscription, isValidWallet } from './_pushValidation.js';

/**
 * Register a Web Push subscription for a given Stellar wallet.
 *
 * Body: { wallet: string, subscription: WebPushSubscription }
 *
 * Persists to Upstash Redis when configured, otherwise in-memory (cold-start lossy).
 * The wallet→subscription mapping lets `/api/push-notify` fan out to all of a
 * wallet's devices on payment / utang events.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { wallet, subscription } = (req.body ?? {}) as {
    wallet?: string;
    subscription?: unknown;
  };

  if (!hasServerVapid()) {
    return res.status(503).json({ error: 'VAPID keys not configured' });
  }

  if (!isValidWallet(wallet)) {
    return res.status(400).json({ error: 'valid Stellar wallet required (G..., 56 chars)' });
  }
  if (!isValidSubscription(subscription)) {
    return res.status(400).json({ error: 'subscription required' });
  }

  try {
    await addSubscription(wallet, subscription);
    return res.status(200).json({ ok: true, persistent: isPersistent() });
  } catch (err: unknown) {
    const message = (err as { message?: string }).message ?? 'store failed';
    return res.status(500).json({ error: message });
  }
}
