import { useCallback, useEffect, useState } from 'react';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
const SUBSCRIBE_URL = import.meta.env.VITE_PUSH_SUBSCRIBE_URL ?? '/api/push-subscribe';
const STORAGE_KEY = 'pp_push_subscription';

export type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

interface State {
  permission: PermissionState;
  subscribed: boolean;
  isSupported: boolean;
  isPending: boolean;
  error: string | null;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function detectPermission(): PermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  const p = Notification.permission;
  return p === 'granted' || p === 'denied' ? p : 'default';
}

export function usePushNotifications(wallet?: string | null) {
  const [state, setState] = useState<State>(() => ({
    permission: detectPermission(),
    subscribed: Boolean(localStorage.getItem(STORAGE_KEY)),
    isSupported: typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,
    isPending: false,
    error: null,
  }));

  // Re-check actual SW push subscription on mount
  useEffect(() => {
    if (!state.isSupported) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        setState((s) => ({ ...s, subscribed: Boolean(sub) }));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enable = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      setState((s) => ({ ...s, error: 'Push notifications not supported on this device' }));
      return false;
    }
    setState((s) => ({ ...s, isPending: true, error: null }));

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState((s) => ({ ...s, permission: permission as PermissionState, isPending: false }));
        return false;
      }

      if (!VAPID_PUBLIC_KEY) {
        // No VAPID key configured — keep foreground Notification API only.
        // Mark as subscribed so the UI reflects the granted permission state.
        setState((s) => ({ ...s, permission: 'granted', subscribed: true, isPending: false }));
        return true;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });

      // POST subscription to backend so it can send pushes later.
      // Wallet-keyed registration enables server-side fan-out via /api/push-notify.
      if (wallet) {
        try {
          await fetch(SUBSCRIBE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ wallet, subscription: sub.toJSON() }),
          });
        } catch { /* backend may not be deployed yet — keep local subscription */ }
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(sub.toJSON()));
      setState((s) => ({ ...s, permission: 'granted', subscribed: true, isPending: false }));
      return true;
    } catch (err: unknown) {
      setState((s) => ({
        ...s,
        isPending: false,
        error: (err as { message?: string }).message ?? 'Failed to enable notifications',
      }));
      return false;
    }
  }, [state.isSupported, wallet]);

  const disable = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) return false;
    setState((s) => ({ ...s, isPending: true }));
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      localStorage.removeItem(STORAGE_KEY);
      setState((s) => ({ ...s, subscribed: false, isPending: false }));
      return true;
    } catch (err: unknown) {
      setState((s) => ({
        ...s,
        isPending: false,
        error: (err as { message?: string }).message ?? 'Failed to disable',
      }));
      return false;
    }
  }, [state.isSupported]);

  /** Send a test push to this device through the server. Confirms VAPID + SW push flow end-to-end. */
  const sendTest = useCallback(async (payload?: { title?: string; body?: string; url?: string }): Promise<boolean> => {
    if (!state.isSupported) return false;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        setState((s) => ({ ...s, error: 'Not subscribed yet — tap Enable first' }));
        return false;
      }
      const res = await fetch('/api/push-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          payload: {
            title: payload?.title ?? 'PalengkePay test',
            body: payload?.body ?? 'Test push — if you see this, notifications work.',
            url: payload?.url ?? '/',
          },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'send failed' })) as { error?: string };
        setState((s) => ({ ...s, error: data.error ?? `Send failed (${res.status})` }));
        return false;
      }
      return true;
    } catch (err: unknown) {
      setState((s) => ({
        ...s,
        error: (err as { message?: string }).message ?? 'Test send failed',
      }));
      return false;
    }
  }, [state.isSupported]);

  return { ...state, enable, disable, sendTest };
}
