import type { VercelRequest, VercelResponse } from '@vercel/node';
import webpush from 'web-push';
import { isValidSubscription, sanitizePayload, serverVapidDetails } from './_pushValidation.js';

/**
 * Push-send endpoint. Stateless — caller passes the target subscription + payload.
 *
 * Caller bears the subscription store responsibility. Today the client passes
 * its own subscription (test push). Once the durable subscription store lands
 * (Vercel KV / Upstash), a Horizon-listener cron will read subscriptions by
 * vendor wallet and call this endpoint to fan out real payment alerts.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
