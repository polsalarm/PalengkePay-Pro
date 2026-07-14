/**
 * Credit-pool auto-repay registry.
 *
 * Tracks which vendors have an active `set_schedule` on which pool asset, so
 * the `cron/credit-collect` relayer knows who to call `collect` on without
 * scanning the whole chain. The contract's own `next_due` gate is the real
 * guard against early/duplicate pulls — this store is purely a worklist.
 *
 * Backed by Upstash Redis when `KV_REST_API_URL` / `KV_REST_API_TOKEN` are
 * set. Falls back to an in-memory set (lost on cold start) otherwise.
 */
export type PoolAsset = 'USDC' | 'XLM';

const REDIS_URL = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

interface MemoryStore { sets: Map<PoolAsset, Set<string>>; }
const memoryGlobal = globalThis as unknown as { __pp_autorepay_store?: MemoryStore };
function memory(): MemoryStore {
  if (!memoryGlobal.__pp_autorepay_store) {
    memoryGlobal.__pp_autorepay_store = { sets: new Map([['USDC', new Set()], ['XLM', new Set()]]) };
  }
  return memoryGlobal.__pp_autorepay_store;
}

function key(asset: PoolAsset): string {
  return `pp:autorepay:${asset.toLowerCase()}`;
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

function hasRedis(): boolean {
  return Boolean(REDIS_URL && REDIS_TOKEN);
}

export async function registerAutoRepayVendor(asset: PoolAsset, vendor: string): Promise<void> {
  if (hasRedis()) {
    await redis(['SADD', key(asset), vendor]);
    return;
  }
  memory().sets.get(asset)?.add(vendor);
}

export async function unregisterAutoRepayVendor(asset: PoolAsset, vendor: string): Promise<void> {
  if (hasRedis()) {
    await redis(['SREM', key(asset), vendor]);
    return;
  }
  memory().sets.get(asset)?.delete(vendor);
}

export async function listAutoRepayVendors(asset: PoolAsset): Promise<string[]> {
  if (hasRedis()) {
    const members = (await redis(['SMEMBERS', key(asset)])) as string[] | null;
    return members ?? [];
  }
  return Array.from(memory().sets.get(asset) ?? []);
}
