import webpush from 'web-push';
import { listSubscriptions, removeSubscription } from './_pushStore.js';

export interface PushPayload {
  title?: string;
  body?: string;
  icon?: string;
  tag?: string;
  url?: string;
}

let vapidConfigured = false;
function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  const publicKey = process.env.VITE_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export interface FanoutResult { sent: number; pruned: number; failures: number; }

export async function fanout(wallet: string, payload: PushPayload): Promise<FanoutResult> {
  if (!ensureVapid()) throw new Error('VAPID not configured');

  const subs = await listSubscriptions(wallet);
  if (subs.length === 0) return { sent: 0, pruned: 0, failures: 0 };

  const body = JSON.stringify({
    title: payload.title ?? 'PalengkePay',
    body: payload.body ?? 'You have a new notification',
    icon: payload.icon ?? '/icon-192.svg',
    tag: payload.tag ?? 'palengkepay',
    url: payload.url ?? '/',
  });

  let sent = 0, pruned = 0, failures = 0;
  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(sub, body);
      sent++;
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await removeSubscription(wallet, sub);
        pruned++;
      } else {
        failures++;
      }
    }
  }));

  return { sent, pruned, failures };
}
