import { TransactionBuilder, Operation } from '@stellar/stellar-sdk';
import { getServer, submitWithFeeBump, NETWORK_PASSPHRASE } from './stellar';

const KEY_OPEN = 'pp_open';
const BASE_FEE = '100';

export interface VendorStatus {
  isOpen: boolean;
  /** True when no `pp_open` data entry exists — vendor never toggled. */
  defaulted: boolean;
}

function decodeBase64(value: string): string {
  try {
    return atob(value);
  } catch {
    return '';
  }
}

export async function fetchVendorStatus(address: string): Promise<VendorStatus> {
  try {
    const server = getServer();
    const account = await server.loadAccount(address);
    const data = (account.data_attr as Record<string, string> | undefined) ?? {};
    const raw = data[KEY_OPEN];
    if (!raw) return { isOpen: true, defaulted: true };
    return { isOpen: decodeBase64(raw) === '1', defaulted: false };
  } catch {
    return { isOpen: true, defaulted: true };
  }
}

export function parseVendorStatusFromDataAttr(
  data: Record<string, string> | undefined,
): VendorStatus {
  const raw = data?.[KEY_OPEN];
  if (!raw) return { isOpen: true, defaulted: true };
  return { isOpen: decodeBase64(raw) === '1', defaulted: false };
}

export async function buildSetStatusXdr(vendorAddress: string, isOpen: boolean): Promise<string> {
  // Preferred path: server endpoint signs the sponsorship sandwich so the vendor
  // never pays the 0.5 XLM base reserve for the new data entry.
  const endpoint = import.meta.env.VITE_SPONSOR_DATA_URL ?? '/api/sponsor-data';
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendor: vendorAddress, isOpen }),
    });
    if (res.ok) {
      const { innerXdr } = await res.json() as { innerXdr: string };
      return innerXdr;
    }
    if (res.status !== 404) {
      const body = await res.json().catch(() => ({ error: 'Sponsor build failed' })) as { error?: string };
      throw new Error(body.error ?? 'Sponsor build failed');
    }
    // 404 means endpoint not deployed (local vite dev without vercel dev) — fall through
  } catch (err) {
    const msg = (err as { message?: string }).message ?? '';
    // Only swallow network errors here; explicit server errors already threw
    if (!msg.toLowerCase().includes('fetch')) throw err;
  }

  // Fallback: build locally. Vendor pays the 0.5 XLM reserve on first toggle.
  const server = getServer();
  const account = await server.loadAccount(vendorAddress);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(Operation.manageData({ name: KEY_OPEN, value: isOpen ? '1' : '0' }))
    .setTimeout(180)
    .build();
  return tx.toXDR();
}

export async function submitSignedStatus(signedInnerXdr: string): Promise<string> {
  const res = await submitWithFeeBump(signedInnerXdr);
  return res.hash;
}
