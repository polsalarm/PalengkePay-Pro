import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isValidWallet } from './_pushValidation.js';
import { registerAutoRepayVendor, unregisterAutoRepayVendor, type PoolAsset } from './_autoRepayStore.js';

/**
 * Frontend calls this right after a vendor's `set_schedule` / `cancel_schedule`
 * tx confirms, so the `cron/credit-collect` relayer knows who to check. Purely
 * a worklist — the contract's own `next_due` gate is what actually protects
 * against early or duplicate collection, so a missed/failed call here just
 * means a vendor's auto-repay is silently skipped until re-registered, not a
 * security issue.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { vendor, asset, action } = (req.body ?? {}) as {
    vendor?: string;
    asset?: string;
    action?: string;
  };

  if (!isValidWallet(vendor)) {
    return res.status(400).json({ error: 'invalid vendor address' });
  }
  if (asset !== 'USDC' && asset !== 'XLM') {
    return res.status(400).json({ error: 'asset must be USDC or XLM' });
  }
  if (action !== 'register' && action !== 'unregister') {
    return res.status(400).json({ error: 'action must be register or unregister' });
  }

  try {
    if (action === 'register') {
      await registerAutoRepayVendor(asset as PoolAsset, vendor);
    } else {
      await unregisterAutoRepayVendor(asset as PoolAsset, vendor);
    }
    return res.status(200).json({ ok: true });
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message ?? 'store write failed' });
  }
}
