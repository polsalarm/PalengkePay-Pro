// Per-address role cache so transient RPC failures never demote a known
// vendor to the customer UI (isRegisteredVendor returns false on ANY error).
export type CachedRole = 'vendor' | 'customer';

const keyFor = (address: string) => `pp_role:${address}`;

export function getCachedRole(address: string | null): CachedRole | null {
  if (!address || typeof window === 'undefined') return null;
  const v = window.localStorage.getItem(keyFor(address));
  return v === 'vendor' || v === 'customer' ? v : null;
}

export function setCachedRole(address: string, role: CachedRole): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(keyFor(address), role);
}
