/**
 * Vendor open/close status store.
 *
 * Off-chain status flag for shop hours. Backed by Upstash Redis when
 * `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_*`)
 * are set. Falls back to in-memory map (per-instance, lost on cold start).
 *
 * Same Redis instance as `_pushStore.ts` and `_rampStore.ts`. Key namespace:
 *   pp:vendor:status:{G_ADDRESS} -> JSON { isOpen, updatedAt }
 */

const REDIS_URL = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

export interface VendorStatusRecord {
  isOpen: boolean;
  updatedAt: number;
}

interface MemoryStore { map: Map<string, VendorStatusRecord>; }
const memoryGlobal = globalThis as unknown as { __pp_status_store?: MemoryStore };
function memory(): MemoryStore {
  if (!memoryGlobal.__pp_status_store) memoryGlobal.__pp_status_store = { map: new Map() };
  return memoryGlobal.__pp_status_store;
}

function key(addr: string): string {
  return `pp:vendor:status:${addr}`;
}

function hasRedis(): boolean {
  return Boolean(REDIS_URL && REDIS_TOKEN);
}

async function redis(command: (string | number)[]): Promise<unknown> {
  if (!REDIS_URL || !REDIS_TOKEN) throw new Error('redis-not-configured');
  const res = await fetch(REDIS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  const data = (await res.json()) as { result?: unknown; error?: string };
  if (data.error) throw new Error(data.error);
  return data.result;
}

export async function getStatus(addr: string): Promise<VendorStatusRecord | null> {
  if (hasRedis()) {
    const raw = (await redis(['GET', key(addr)])) as string | null;
    return raw ? (JSON.parse(raw) as VendorStatusRecord) : null;
  }
  return memory().map.get(addr) ?? null;
}

export async function setStatus(addr: string, rec: VendorStatusRecord): Promise<void> {
  if (hasRedis()) {
    await redis(['SET', key(addr), JSON.stringify(rec)]);
    return;
  }
  memory().map.set(addr, rec);
}

export async function getStatuses(addrs: string[]): Promise<Map<string, VendorStatusRecord>> {
  const out = new Map<string, VendorStatusRecord>();
  if (addrs.length === 0) return out;
  if (hasRedis()) {
    const raw = (await redis(['MGET', ...addrs.map(key)])) as (string | null)[];
    raw.forEach((v, i) => { if (v) out.set(addrs[i], JSON.parse(v) as VendorStatusRecord); });
    return out;
  }
  const mem = memory().map;
  for (const a of addrs) {
    const v = mem.get(a);
    if (v) out.set(a, v);
  }
  return out;
}

export function isPersistent(): boolean {
  return hasRedis();
}
