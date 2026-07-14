import type { VercelRequest, VercelResponse } from '@vercel/node';
import webpush from 'web-push';
import { addSubscription, isPersistent } from './_pushStore.js';
import { fanout } from './_pushFanout.js';
import {
  hasServerVapid, isValidSubscription, isValidWallet, sanitizePayload, serverVapidDetails,
} from './_pushValidation.js';

/**
 * Consolidated push dispatcher.
 *
 * Vercel Hobby plan caps Serverless Functions at 12 per deployment (see
 * ramp.ts), so the individual /api/push-* files are collapsed into one
 * handler dispatching on the `_op` query param (set by vercel.json rewrites).
 *
 *   /api/push-notify    → _op=notify
 *   /api/push-send      → _op=send
 *   /api/push-subscribe → _op=subscribe
 */

/** Fan out a push notification to every subscription registered under a wallet. */
async function handleNotify(req: VercelRequest, res: VercelResponse) {
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

/** Stateless send — caller passes the target subscription + payload directly (test push). */
async function handleSend(req: VercelRequest, res: VercelResponse) {
  const { subscription, payload } = (req.body ?? {}) as {
    subscription?: unknown;
    payload?: unknown;
  };

  if (!isValidSubscription(subscription)) {
    return res.status(400).json({ error: 'subscription required' });
  }

  const vapid = serverVapidDetails();
  if (!vapid) {
    return res.status(500).json({ error: 'VAPID keys not configured' });
  }

  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  const body = JSON.stringify(sanitizePayload(payload));

  try {
    const result = await webpush.sendNotification(subscription, body);
    return res.status(200).json({ ok: true, statusCode: result.statusCode });
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    const message = (err as { body?: string; message?: string }).body
      ?? (err as { message?: string }).message
      ?? 'Push send failed';
    return res.status(statusCode === 410 ? 410 : 500).json({ error: message, statusCode });
  }
}

/** Register a Web Push subscription for a given Stellar wallet. */
async function handleSubscribe(req: VercelRequest, res: VercelResponse) {
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const op = (req.query._op as string | undefined) ?? '';
  switch (op) {
    case 'notify':
      return handleNotify(req, res);
    case 'send':
      return handleSend(req, res);
    case 'subscribe':
      return handleSubscribe(req, res);
    default:
      return res.status(404).json({ error: 'unknown push operation' });
  }
}
