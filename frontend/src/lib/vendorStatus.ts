import {
  Account, Memo, Operation, TransactionBuilder,
} from '@stellar/stellar-sdk';
import { NETWORK_PASSPHRASE } from './stellar';

const STATUS_ENDPOINT = (import.meta.env.VITE_VENDOR_STATUS_URL as string | undefined) ?? '/api/vendor-status';
const MEMO_PREFIX = 'PPSTAT:';
const CHALLENGE_TTL_SECONDS = 300;

export interface VendorStatus {
  isOpen: boolean;
  /** True when no off-chain status record exists — vendor never toggled. */
  defaulted: boolean;
  updatedAt?: number;
}

function randomNonce(): string {
  const bytes = new Uint8Array(9);
  globalThis.crypto.getRandomValues(bytes);
  // base64url, 12 chars
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function fetchVendorStatus(address: string): Promise<VendorStatus> {
  try {
    const res = await fetch(`${STATUS_ENDPOINT}?vendor=${encodeURIComponent(address)}`);
    if (!res.ok) return { isOpen: true, defaulted: true };
    const body = await res.json() as VendorStatus;
    return body;
  } catch {
    return { isOpen: true, defaulted: true };
  }
}

export async function fetchVendorStatuses(addresses: string[]): Promise<Map<string, VendorStatus>> {
  const out = new Map<string, VendorStatus>();
  if (addresses.length === 0) return out;
  try {
    const qs = encodeURIComponent(addresses.join(','));
    const res = await fetch(`${STATUS_ENDPOINT}?vendors=${qs}`);
    if (!res.ok) {
      for (const a of addresses) out.set(a, { isOpen: true, defaulted: true });
      return out;
    }
    const body = await res.json() as { statuses?: Record<string, VendorStatus>; isOpen?: boolean; defaulted?: boolean };
    if (body.statuses) {
      for (const [a, s] of Object.entries(body.statuses)) out.set(a, s);
    } else if (typeof body.isOpen === 'boolean') {
      // Single-vendor response shape (when only one address was sent)
      out.set(addresses[0], { isOpen: body.isOpen, defaulted: Boolean(body.defaulted) });
    }
    for (const a of addresses) if (!out.has(a)) out.set(a, { isOpen: true, defaulted: true });
    return out;
  } catch {
    for (const a of addresses) out.set(a, { isOpen: true, defaulted: true });
    return out;
  }
}

/**
 * Build a challenge transaction the vendor will sign to prove ownership of
 * their G-address. The transaction is NEVER submitted to Horizon — the server
 * only verifies the signature and reads the memo to determine the desired
 * status. Sequence number is set to "0" so any accidental submission would
 * fail with tx_bad_seq.
 */
export function buildSetStatusXdr(vendorAddress: string, isOpen: boolean): string {
  const nonce = randomNonce();
  const memoText = `${MEMO_PREFIX}${isOpen ? '1' : '0'}:${nonce}`.slice(0, 28);
  const account = new Account(vendorAddress, '0');
  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(Operation.manageData({ name: 'pp_status_challenge', value: nonce }))
    .addMemo(Memo.text(memoText))
    .setTimeout(CHALLENGE_TTL_SECONDS)
    .build();
  return tx.toXDR();
}

export async function submitSignedStatus(signedXdr: string): Promise<void> {
  const res = await fetch(STATUS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signedXdr }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Status update failed' })) as { error?: string };
    throw new Error(body.error ?? 'Status update failed');
  }
}
