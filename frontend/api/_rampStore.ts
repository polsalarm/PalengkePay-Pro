/**
 * Ramp state store.
 *
 * Tracks SEP-24 deposit/withdrawal transactions plus internal cash-in/cash-out
 * jobs through their PDAX legs. Backed by Upstash Redis (same instance as the
 * push subscription store) with an in-memory fallback for cold-start dev.
 *
 * Two indexes are maintained:
 *   - pp:ramp:{id}            -> JSON blob (per-transaction)
 *   - pp:ramp:wallet:{wallet} -> set of ids (per-customer lookup)
 *   - pp:ramp:pending         -> set of ids that need polling/finalization
 */

const REDIS_URL = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

export type RampKind = 'deposit' | 'withdraw';
export type RampStatus =
  | 'incomplete'
  | 'pending_user_transfer_start'
  | 'pending_anchor'
  | 'pending_external'
  | 'pending_stellar'
  | 'completed'
  | 'no_market'
  | 'error';

export interface RampTxn {
  id: string;
  wallet: string;
  kind: RampKind;
  status: RampStatus;
  asset: string;
  amountIn: string;
  amountOut?: string;
  amountFee?: string;
  rate?: string;
  rail?: string;
  destination?: string;
  stellarTxHash?: string;
  externalTxId?: string;
  pdaxOrderId?: string;
  pdaxCashoutId?: string;
  pdaxWithdrawId?: string;
  message?: string;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
}

interface MemoryStore {
  blobs: Map<string, string>;
  walletIndex: Map<string, Set<string>>;
  pending: Set<string>;
}

const memoryGlobal = globalThis as unknown as { __pp_ramp_store?: MemoryStore };
function memory(): MemoryStore {
  if (!memoryGlobal.__pp_ramp_store) {
    memoryGlobal.__pp_ramp_store = { blobs: new Map(), walletIndex: new Map(), pending: new Set() };
  }
  return memoryGlobal.__pp_ramp_store;
}

const PENDING_INDEX = 'pp:ramp:pending';
const txnKey = (id: string) => `pp:ramp:${id}`;
const walletKey = (wallet: string) => `pp:ramp:wallet:${wallet}`;

function hasRedis(): boolean {
  return Boolean(REDIS_URL && REDIS_TOKEN);
}

async function redis(command: (string | number)[]): Promise<unknown> {
  if (!REDIS_URL || !REDIS_TOKEN) throw new Error('redis-not-configured');
  const res = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  const data = (await res.json()) as { result?: unknown; error?: string };
  if (data.error) throw new Error(data.error);
  return data.result;
}

function newId(): string {
  return `rmp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function isTerminal(status: RampStatus): boolean {
  return status === 'completed' || status === 'error' || status === 'no_market';
}

export async function createTxn(params: Omit<RampTxn, 'id' | 'startedAt' | 'updatedAt'>): Promise<RampTxn> {
  const now = Date.now();
  const txn: RampTxn = { ...params, id: newId(), startedAt: now, updatedAt: now };
  const blob = JSON.stringify(txn);
  if (hasRedis()) {
    await redis(['SET', txnKey(txn.id), blob]);
    await redis(['SADD', walletKey(txn.wallet), txn.id]);
    if (!isTerminal(txn.status)) await redis(['SADD', PENDING_INDEX, txn.id]);
  } else {
    const m = memory();
    m.blobs.set(txn.id, blob);
    let set = m.walletIndex.get(txn.wallet);
    if (!set) { set = new Set(); m.walletIndex.set(txn.wallet, set); }
    set.add(txn.id);
    if (!isTerminal(txn.status)) m.pending.add(txn.id);
  }
  return txn;
}

export async function getTxn(id: string): Promise<RampTxn | null> {
  if (hasRedis()) {
    const blob = (await redis(['GET', txnKey(id)])) as string | null;
    return blob ? (JSON.parse(blob) as RampTxn) : null;
  }
  const blob = memory().blobs.get(id);
  return blob ? (JSON.parse(blob) as RampTxn) : null;
}

export async function updateTxn(id: string, patch: Partial<Omit<RampTxn, 'id' | 'startedAt'>>): Promise<RampTxn | null> {
  const current = await getTxn(id);
  if (!current) return null;
  const merged: RampTxn = { ...current, ...patch, updatedAt: Date.now() };
  if (isTerminal(merged.status) && !merged.completedAt) merged.completedAt = Date.now();
  const blob = JSON.stringify(merged);
  if (hasRedis()) {
    await redis(['SET', txnKey(id), blob]);
    if (isTerminal(merged.status)) await redis(['SREM', PENDING_INDEX, id]);
  } else {
    memory().blobs.set(id, blob);
    if (isTerminal(merged.status)) memory().pending.delete(id);
  }
  return merged;
}

export async function listForWallet(wallet: string): Promise<RampTxn[]> {
  let ids: string[];
  if (hasRedis()) {
    ids = ((await redis(['SMEMBERS', walletKey(wallet)])) as string[] | null) ?? [];
  } else {
    ids = Array.from(memory().walletIndex.get(wallet) ?? []);
  }
  const txns: RampTxn[] = [];
  for (const id of ids) {
    const t = await getTxn(id);
    if (t) txns.push(t);
  }
  return txns.sort((a, b) => b.startedAt - a.startedAt);
}

export async function listPending(): Promise<RampTxn[]> {
  let ids: string[];
  if (hasRedis()) {
    ids = ((await redis(['SMEMBERS', PENDING_INDEX])) as string[] | null) ?? [];
  } else {
    ids = Array.from(memory().pending);
  }
  const out: RampTxn[] = [];
  for (const id of ids) {
    const t = await getTxn(id);
    if (t) out.push(t);
  }
  return out;
}

export function isPersistent(): boolean {
  return hasRedis();
}
