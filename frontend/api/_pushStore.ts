/**
 * Push subscription store.
 *
 * Backed by Upstash Redis when `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
 * are set. Falls back to an in-memory map (lost on cold start) otherwise — good
 * enough for demo, swap to Redis for prod fan-out.
 *
 * Subscriptions are stored as JSON strings in a Redis set keyed by wallet address.
 * Set semantics dedupe identical subscriptions automatically.
 */
import type { PushSubscription as WebPushSubscription } from 'web-push';

const REDIS_URL = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

interface MemoryStore { sets: Map<string, Set<string>>; wallets: Set<string>; }
const memoryGlobal = globalThis as unknown as { __pp_push_store?: MemoryStore };
function memory(): MemoryStore {
  if (!memoryGlobal.__pp_push_store) memoryGlobal.__pp_push_store = { sets: new Map(), wallets: new Set() };
  return memoryGlobal.__pp_push_store;
}

function key(wallet: string): string {
  return `pp:push:${wallet}`;
}

const WALLET_INDEX = 'pp:push:wallets';

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

export async function addSubscription(wallet: string, sub: WebPushSubscription): Promise<void> {
  const member = JSON.stringify(sub);
  if (hasRedis()) {
    await redis(['SADD', key(wallet), member]);
    await redis(['SADD', WALLET_INDEX, wallet]);
    return;
  }
  const store = memory();
  let set = store.sets.get(wallet);
  if (!set) { set = new Set(); store.sets.set(wallet, set); }
  set.add(member);
  store.wallets.add(wallet);
}

export async function listAllWallets(): Promise<string[]> {
  if (hasRedis()) {
    const members = (await redis(['SMEMBERS', WALLET_INDEX])) as string[] | null;
    return members ?? [];
  }
  return Array.from(memory().wallets);
}

export async function listSubscriptions(wallet: string): Promise<WebPushSubscription[]> {
  if (hasRedis()) {
    const members = (await redis(['SMEMBERS', key(wallet)])) as string[] | null;
    if (!members) return [];
    return members.map((m) => JSON.parse(m) as WebPushSubscription);
  }
  const set = memory().sets.get(wallet);
  if (!set) return [];
  return Array.from(set).map((m) => JSON.parse(m) as WebPushSubscription);
}

export async function removeSubscription(wallet: string, sub: WebPushSubscription): Promise<void> {
  const member = JSON.stringify(sub);
  if (hasRedis()) {
    await redis(['SREM', key(wallet), member]);
    return;
  }
  memory().sets.get(wallet)?.delete(member);
}

export function isPersistent(): boolean {
  return hasRedis();
}
