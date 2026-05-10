import { getServer } from './stellar';

export interface IndexedPayment {
  id: string;
  from: string;
  to: string;
  amountXlm: number;
  createdAt: string;
  memo?: string;
}

interface IndexStore {
  address: string;
  cursor: string;
  payments: IndexedPayment[];
  syncedAt: string;
}

const PREFIX = 'pp_idx_';

function storageKey(address: string) {
  return PREFIX + address;
}

function loadStore(address: string): IndexStore {
  try {
    const raw = localStorage.getItem(storageKey(address));
    if (raw) return JSON.parse(raw) as IndexStore;
  } catch { /* ignore */ }
  return { address, cursor: 'now', payments: [], syncedAt: '' };
}

function saveStore(store: IndexStore) {
  try {
    localStorage.setItem(storageKey(store.address), JSON.stringify(store));
  } catch { /* storage full — skip */ }
}

async function fetchSince(address: string, cursor: string): Promise<{ payments: IndexedPayment[]; cursor: string }> {
  const server = getServer();

  const [payPage, txPage] = await Promise.all([
    server.payments().forAccount(address).order('asc').cursor(cursor === 'now' ? '' : cursor).limit(100).call(),
    server.transactions().forAccount(address).order('desc').limit(50).call(),
  ]);

  const memoByHash = new Map<string, string>();
  for (const tx of txPage.records) {
    const t = tx as { id: string; memo_type?: string; memo?: string };
    if (t.memo_type === 'text' && t.memo) memoByHash.set(t.id, t.memo);
  }

  const payments: IndexedPayment[] = payPage.records
    .filter((r) => r.type === 'payment' && (r as { asset_type: string }).asset_type === 'native')
    .map((r) => {
      const p = r as { paging_token: string; transaction_hash: string; from: string; to: string; amount: string; created_at: string };
      return {
        id: p.transaction_hash,
        from: p.from,
        to: p.to,
        amountXlm: parseFloat(p.amount),
        createdAt: p.created_at,
        memo: memoByHash.get(p.transaction_hash),
      };
    });

  const lastRecord = payPage.records[payPage.records.length - 1] as { paging_token?: string } | undefined;
  const newCursor = lastRecord?.paging_token ?? cursor;

  return { payments, cursor: newCursor };
}

/** Sync payments for address. Returns merged sorted list (newest first). */
export async function syncPayments(address: string): Promise<IndexedPayment[]> {
  const store = loadStore(address);
  const { payments: fresh, cursor } = await fetchSince(address, store.cursor);

  if (fresh.length === 0) return [...store.payments].reverse();

  const existing = new Map(store.payments.map((p) => [p.id, p]));
  for (const p of fresh) existing.set(p.id, p);

  const merged = Array.from(existing.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  saveStore({ address, cursor, payments: merged, syncedAt: new Date().toISOString() });
  return [...merged].reverse();
}

/** Read cached payments without network call. Returns newest first. */
export function getCachedPayments(address: string): IndexedPayment[] {
  return [...loadStore(address).payments].reverse();
}

/** Clear index for address (e.g. on wallet disconnect). */
export function clearIndex(address: string) {
  localStorage.removeItem(storageKey(address));
}
