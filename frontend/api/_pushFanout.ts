import webpush from 'web-push';
import { listSubscriptions, removeSubscription } from './_pushStore.js';
import { sanitizePayload, serverVapidDetails, type PushPayload } from './_pushValidation.js';

let vapidConfigured = false;
function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  const details = serverVapidDetails();
  if (!details) return false;
  webpush.setVapidDetails(details.subject, details.publicKey, details.privateKey);
  vapidConfigured = true;
  return true;
}

export interface FanoutResult { sent: number; pruned: number; failures: number; }

export async function fanout(wallet: string, payload: PushPayload): Promise<FanoutResult> {
  if (!ensureVapid()) throw new Error('VAPID not configured');

  const subs = await listSubscriptions(wallet);
  if (subs.length === 0) return { sent: 0, pruned: 0, failures: 0 };

  const body = JSON.stringify(sanitizePayload(payload));

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
