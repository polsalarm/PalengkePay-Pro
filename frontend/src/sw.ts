/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

precacheAndRoute(self.__WB_MANIFEST);

// Lifecycle: do NOT skipWaiting+claim aggressively. Mid-session takeover
// caused visible reloads on iOS Safari when the user clicked links right
// after a new deploy. The new SW becomes active naturally on the next
// full page load instead.
//
// (No install/activate handlers — defaults are correct: install waits
// for old SW to release, activate fires after the old SW unregisters.)

interface PushPayload {
  title?: string;
  body?: string;
  icon?: string;
  tag?: string;
  url?: string;
}

self.addEventListener('push', (event) => {
  let payload: PushPayload;
  try {
    payload = event.data ? (event.data.json() as PushPayload) : {};
  } catch {
    payload = { body: event.data?.text() };
  }

  const title = payload.title ?? 'PalengkePay';
  const body = payload.body ?? 'You have a new notification';
  const icon = payload.icon ?? '/icon-192.svg';
  const tag = payload.tag ?? 'palengkepay';
  const url = payload.url ?? '/';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: '/icon-192.svg',
      tag,
      data: { url },
    } as NotificationOptions),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && 'focus' in client) {
          return (client as WindowClient).focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
