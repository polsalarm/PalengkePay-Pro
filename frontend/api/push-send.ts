import type { VercelRequest, VercelResponse } from '@vercel/node';
import webpush from 'web-push';

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

  const publicKey = process.env.VITE_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    return res.status(500).json({ error: 'VAPID keys not configured' });
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);

  const { subscription, payload } = (req.body ?? {}) as {
    subscription?: webpush.PushSubscription;
    payload?: {
      title?: string;
      body?: string;
      icon?: string;
      tag?: string;
      url?: string;
    };
  };

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'subscription required' });
  }

  const body = JSON.stringify({
    title: payload?.title ?? 'PalengkePay',
    body: payload?.body ?? 'You have a new notification',
    icon: payload?.icon ?? '/icon-192.svg',
    tag: payload?.tag ?? 'palengkepay',
    url: payload?.url ?? '/',
  });

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
