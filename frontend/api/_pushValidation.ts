import type webpush from 'web-push';

export interface PushPayload {
  title?: string;
  body?: string;
  icon?: string;
  tag?: string;
  url?: string;
}

const WALLET_RE = /^G[A-Z2-7]{55}$/;

function clip(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

function localPath(value: unknown, fallback: string): string {
  const path = clip(value, 160);
  if (!path || !path.startsWith('/') || path.startsWith('//')) return fallback;
  return path;
}

export function isValidWallet(wallet: unknown): wallet is string {
  return typeof wallet === 'string' && WALLET_RE.test(wallet);
}

export function sanitizePayload(payload: unknown): Required<PushPayload> {
  const p = (payload ?? {}) as PushPayload;
  return {
    title: clip(p.title, 80) ?? 'PalengkePay',
    body: clip(p.body, 220) ?? 'You have a new notification',
    icon: localPath(p.icon, '/icon-192.svg'),
    tag: clip(p.tag, 80)?.replace(/[^\w:.-]/g, '-') ?? 'palengkepay',
    url: localPath(p.url, '/'),
  };
}

export function isValidSubscription(subscription: unknown): subscription is webpush.PushSubscription {
  const sub = subscription as webpush.PushSubscription | undefined;
  const keys = sub?.keys as { p256dh?: string; auth?: string } | undefined;
  return Boolean(
    sub
    && typeof sub.endpoint === 'string'
    && sub.endpoint.startsWith('https://')
    && sub.endpoint.length <= 2048
    && typeof keys?.p256dh === 'string'
    && keys.p256dh.length > 0
    && typeof keys?.auth === 'string'
    && keys.auth.length > 0,
  );
}

export function hasServerVapid(): boolean {
  return Boolean(
    (process.env.VAPID_PUBLIC_KEY ?? process.env.VITE_VAPID_PUBLIC_KEY)
    && process.env.VAPID_PRIVATE_KEY
    && process.env.VAPID_SUBJECT,
  );
}

export function serverVapidDetails(): { subject: string; publicKey: string; privateKey: string } | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY ?? process.env.VITE_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return null;
  return { subject, publicKey, privateKey };
}
