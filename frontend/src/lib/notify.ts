/**
 * Fire a server-side push notification fan-out for a given Stellar wallet.
 * Best-effort — errors swallowed so payment UX isn't blocked by push failures.
 */
export async function notifyWallet(
  wallet: string,
  payload: { title: string; body: string; url?: string; tag?: string; icon?: string },
): Promise<void> {
  try {
    await fetch('/api/push-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, payload }),
    });
  } catch { /* push is best-effort */ }
}
