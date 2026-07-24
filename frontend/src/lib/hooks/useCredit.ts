import { useState, useEffect, useCallback } from 'react';
import {
  NETWORK_PASSPHRASE,
  IS_MAINNET,
  simulateViewCall, prepareContractTx, submitSorobanTx, getLatestLedgerSequence,
  addressToScVal, i128ToScVal, u32ToScVal, u64ToScVal,
  fetchContractEvents,
} from '../stellar';
import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit';

// Credit RWA layer reads the registry that exposes get_credit_score. On testnet
// that's a separate v2 registry (v1 predates the credit-score fns); on mainnet
// there's only ever been one registry, and it was upgraded in place to add
// credit-score + multisig, so the primary registry env IS the credit registry.
const REGISTRY_TESTNET_V2 = import.meta.env.VITE_VENDOR_REGISTRY_V2_CONTRACT_ID as string | undefined;
const REGISTRY_MAINNET = import.meta.env.VITE_VENDOR_REGISTRY_CONTRACT_ID as string | undefined;
const CREDIT_REGISTRY = IS_MAINNET ? REGISTRY_MAINNET : REGISTRY_TESTNET_V2;
const POOL_USDC = import.meta.env.VITE_CREDIT_POOL_USDC_CONTRACT_ID as string | undefined;
const POOL_XLM = import.meta.env.VITE_CREDIT_POOL_XLM_CONTRACT_ID as string | undefined;
const USDC_SAC = import.meta.env.VITE_USDC_SAC_CONTRACT_ID as string | undefined;
const XLM_SAC = import.meta.env.VITE_XLM_SAC_CONTRACT_ID as string | undefined;

export const creditLayerConfigured = !!(CREDIT_REGISTRY && (POOL_USDC || POOL_XLM));

export type PoolAsset = 'USDC' | 'XLM';

export function poolId(asset: PoolAsset): string | undefined {
  return asset === 'USDC' ? POOL_USDC : POOL_XLM;
}

export function tokenId(asset: PoolAsset): string | undefined {
  return asset === 'USDC' ? USDC_SAC : XLM_SAC;
}

/** Auto-repay cadence presets shown in the Vault UI. */
export const SCHEDULE_PRESETS = [
  { label: 'Daily', seconds: 86_400 },
  { label: 'Weekly', seconds: 7 * 86_400 },
  { label: 'Monthly', seconds: 30 * 86_400 },
] as const;

/** ~90 days of ledgers (protocol close time ~5s) — how long an auto-repay
 *  allowance stays valid before the vendor needs to re-approve. */
const APPROVAL_LEDGER_WINDOW = 1_555_200;

const STROOP_FACTOR = 10_000_000;

/** i128 stroops (7-decimal) → human units. */
export function toUnits(stroops: bigint): number {
  return Number(stroops) / STROOP_FACTOR;
}

/** human units → i128 stroops (7-decimal), rounded. */
export function toStroops(units: number): bigint {
  return BigInt(Math.round(units * STROOP_FACTOR));
}

export interface ScoreTier {
  label: string;
  color: string;
}

/** Maps a 300–850 score to a FICO-style band label + accent colour. */
export function scoreTier(score: number): ScoreTier {
  if (score >= 750) return { label: 'Excellent', color: '#059669' };
  if (score >= 670) return { label: 'Good', color: '#14B8A6' };
  if (score >= 580) return { label: 'Fair', color: '#D97706' };
  if (score > 300) return { label: 'Building', color: '#F59E0B' };
  return { label: 'No credit yet', color: '#94A3B8' };
}

// ── On-chain credit score ─────────────────────────────────────────────────────

export function useCreditScore(address: string | null) {
  const [score, setScore] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!address || !CREDIT_REGISTRY) { setScore(null); return; }
    setIsLoading(true);
    simulateViewCall(CREDIT_REGISTRY, 'get_credit_score', [addressToScVal(address)])
      .then((raw) => setScore(raw == null ? 300 : Number(raw)))
      .catch(() => setScore(null))
      .finally(() => setIsLoading(false));
  }, [address, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { score, isLoading, refetch };
}

// ── Score-gated lending pool ──────────────────────────────────────────────────

export interface CreditPoolState {
  limit: bigint;       // total credit line (stroops)
  available: bigint;   // drawable right now (stroops)
  debt: bigint;        // outstanding principal (stroops)
  poolBalance: bigint; // free liquidity in the pool (stroops)
}

export function useCreditPool(address: string | null, asset: PoolAsset) {
  const pid = poolId(asset);
  const [state, setState] = useState<CreditPoolState>({
    limit: 0n, available: 0n, debt: 0n, poolBalance: 0n,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!address || !pid) return;
    setIsLoading(true);
    Promise.all([
      simulateViewCall(pid, 'credit_limit', [addressToScVal(address)]),
      simulateViewCall(pid, 'available_to', [addressToScVal(address)]),
      simulateViewCall(pid, 'debt', [addressToScVal(address)]),
      simulateViewCall(pid, 'pool_balance', []),
    ])
      .then(([l, a, d, p]) => setState({
        limit: BigInt(String(l ?? 0)),
        available: BigInt(String(a ?? 0)),
        debt: BigInt(String(d ?? 0)),
        poolBalance: BigInt(String(p ?? 0)),
      }))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [address, pid, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  const submit = useCallback(async (method: 'deposit' | 'draw' | 'repay', units: number): Promise<string> => {
    if (!address || !pid) throw new Error('Credit pool not configured');
    const xdr = await prepareContractTx(address, pid, method, [
      addressToScVal(address),
      i128ToScVal(toStroops(units)),
    ]);
    const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
      networkPassphrase: NETWORK_PASSPHRASE,
      address,
    });
    return submitSorobanTx(signedTxXdr);
  }, [address, pid]);

  const draw = useCallback((units: number) => submit('draw', units), [submit]);
  const repay = useCallback((units: number) => submit('repay', units), [submit]);
  const deposit = useCallback((units: number) => submit('deposit', units), [submit]);

  return { ...state, isLoading, refetch, draw, repay, deposit };
}

// ── Scheduled auto-repay ───────────────────────────────────────────────────────

export interface ScheduleConfig {
  interval_seconds: bigint;
  amount_per_period: bigint;
  next_due: bigint;
}

/** Best-effort — tells the cron relayer which vendors to check. Never blocks
 *  the on-chain flow: the contract's own cadence gate is the real guard. */
function notifyAutoRepayRegistry(vendor: string, asset: PoolAsset, action: 'register' | 'unregister') {
  fetch('/api/credit-autorepay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vendor, asset, action }),
  }).catch(() => {});
}

export function useAutoRepay(address: string | null, asset: PoolAsset) {
  const pid = poolId(asset);
  const tid = tokenId(asset);
  const [schedule, setSchedule] = useState<ScheduleConfig | null>(null);
  const [allowance, setAllowance] = useState<bigint>(0n);
  const [isLoading, setIsLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!address || !pid || !tid) { setSchedule(null); setAllowance(0n); return; }
    setIsLoading(true);
    Promise.all([
      simulateViewCall(pid, 'schedule', [addressToScVal(address)]),
      simulateViewCall(tid, 'allowance', [addressToScVal(address), addressToScVal(pid)]),
    ])
      .then(([s, a]) => {
        setSchedule(s ? (s as ScheduleConfig) : null);
        setAllowance(BigInt(String(a ?? 0)));
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [address, pid, tid, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  /** Two sequential vendor-signed txs — Soroban allows only one contract
   *  invocation per transaction, so `approve` + `set_schedule` can't be
   *  merged into a single signature. */
  const enable = useCallback(async (intervalSeconds: number, amountUnits: number, capUnits: number): Promise<void> => {
    if (!address || !pid || !tid) throw new Error('Credit pool not configured');

    const expirationLedger = (await getLatestLedgerSequence()) + APPROVAL_LEDGER_WINDOW;
    const approveXdr = await prepareContractTx(address, tid, 'approve', [
      addressToScVal(address),
      addressToScVal(pid),
      i128ToScVal(toStroops(capUnits)),
      u32ToScVal(expirationLedger),
    ]);
    const { signedTxXdr: signedApprove } = await StellarWalletsKit.signTransaction(approveXdr, {
      networkPassphrase: NETWORK_PASSPHRASE,
      address,
    });
    await submitSorobanTx(signedApprove);

    const scheduleXdr = await prepareContractTx(address, pid, 'set_schedule', [
      addressToScVal(address),
      u64ToScVal(intervalSeconds),
      i128ToScVal(toStroops(amountUnits)),
    ]);
    const { signedTxXdr: signedSchedule } = await StellarWalletsKit.signTransaction(scheduleXdr, {
      networkPassphrase: NETWORK_PASSPHRASE,
      address,
    });
    await submitSorobanTx(signedSchedule);

    notifyAutoRepayRegistry(address, asset, 'register');
    refetch();
  }, [address, pid, tid, asset, refetch]);

  const cancel = useCallback(async (): Promise<void> => {
    if (!address || !pid) throw new Error('Credit pool not configured');
    const xdr = await prepareContractTx(address, pid, 'cancel_schedule', [addressToScVal(address)]);
    const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
      networkPassphrase: NETWORK_PASSPHRASE,
      address,
    });
    await submitSorobanTx(signedTxXdr);

    notifyAutoRepayRegistry(address, asset, 'unregister');
    refetch();
  }, [address, pid, asset, refetch]);

  return { schedule, allowance, isLoading, refetch, enable, cancel };
}

// ── Vault activity (deposit/draw/repay/collect history) ───────────────────────

export type VaultActivityType = 'fund' | 'draw' | 'repay' | 'collect';

export interface VaultActivityItem {
  id: string;
  type: VaultActivityType;
  asset: PoolAsset;
  actor: string;      // vendor for draw/repay/collect, LP for fund
  amount: bigint;      // stroops
  newDebt?: bigint;     // stroops — vendor's outstanding principal after this event
  ledger: number;
  closedAt: string;    // ISO timestamp
  txHash: string;
}

function toBigIntSafe(value: unknown): bigint {
  if (value == null) return 0n;
  return BigInt(String(value));
}

async function fetchPoolActivity(asset: PoolAsset): Promise<VaultActivityItem[]> {
  const pid = poolId(asset);
  if (!pid) return [];

  const [fundEvents, creditEvents] = await Promise.all([
    fetchContractEvents(pid, 'pool'),
    fetchContractEvents(pid, 'credit'),
  ]);

  const items: VaultActivityItem[] = [];

  for (const event of fundEvents) {
    const v = event.value as { from?: unknown; amount?: unknown };
    items.push({
      id: event.id,
      type: 'fund',
      asset,
      actor: String(v.from ?? ''),
      amount: toBigIntSafe(v.amount),
      ledger: event.ledger,
      closedAt: event.closedAt,
      txHash: event.txHash,
    });
  }

  for (const event of creditEvents) {
    const kind = event.topics[1] as VaultActivityType | undefined;
    if (kind !== 'draw' && kind !== 'repay' && kind !== 'collect') continue;
    const v = event.value as { vendor?: unknown; amount?: unknown; new_debt?: unknown };
    items.push({
      id: event.id,
      type: kind,
      asset,
      actor: String(v.vendor ?? ''),
      amount: toBigIntSafe(v.amount),
      newDebt: toBigIntSafe(v.new_debt),
      ledger: event.ledger,
      closedAt: event.closedAt,
      txHash: event.txHash,
    });
  }

  return items;
}

/** Vault-wide activity feed (fund/draw/repay/collect) across the given pools,
 *  built from contract events — the pool contract only stores current debt,
 *  not history, so this is the only source for "who borrowed/repaid what". */
export function useVaultActivity(assets: PoolAsset[]) {
  const key = assets.join(',');
  const [items, setItems] = useState<VaultActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!key) { setItems([]); return; }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    Promise.all(key.split(',').map((asset) => fetchPoolActivity(asset as PoolAsset)))
      .then((groups) => {
        if (cancelled) return;
        setItems(groups.flat().sort((a, b) => b.ledger - a.ledger));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setItems([]);
        setError((err as { message?: string })?.message ?? 'Could not load vault activity');
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [key, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { items, isLoading, error, refetch };
}

// ── Current borrowers (live outstanding debt per vendor) ──────────────────────

export interface VaultBorrower {
  wallet: string;
  name?: string;
  asset: PoolAsset;
  debt: bigint;
  limit: bigint;
}

interface VendorLike {
  wallet: string;
  name?: string;
}

async function fetchAssetBorrowers(asset: PoolAsset, vendors: VendorLike[]): Promise<VaultBorrower[]> {
  const pid = poolId(asset);
  if (!pid || vendors.length === 0) return [];

  const rows = await Promise.all(
    vendors.map(async (vendor) => {
      const [debt, limit] = await Promise.all([
        simulateViewCall(pid, 'debt', [addressToScVal(vendor.wallet)]),
        simulateViewCall(pid, 'credit_limit', [addressToScVal(vendor.wallet)]),
      ]);
      return {
        wallet: vendor.wallet,
        name: vendor.name,
        asset,
        debt: BigInt(String(debt ?? 0)),
        limit: BigInt(String(limit ?? 0)),
      };
    })
  );

  return rows.filter((row) => row.debt > 0n);
}

/** Vendors currently carrying an outstanding balance on a pool — the pool
 *  contract only stores debt per-address, not a "list all borrowers" view,
 *  so this checks every registered vendor's debt directly. Live current
 *  state (unlike [[useVaultActivity]], which is historical events) — shows
 *  up immediately even if the draw happened before the event-retention
 *  window the RPC will actually serve. */
export function useVaultBorrowers(assets: PoolAsset[], vendors: VendorLike[]) {
  const assetKey = assets.join(',');
  const vendorKey = vendors.map((v) => v.wallet).join(',');
  const [borrowers, setBorrowers] = useState<VaultBorrower[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!assetKey || !vendorKey) { setBorrowers([]); return; }
    let cancelled = false;
    setIsLoading(true);
    Promise.all(assetKey.split(',').map((asset) => fetchAssetBorrowers(asset as PoolAsset, vendors)))
      .then((groups) => {
        if (cancelled) return;
        setBorrowers(groups.flat().sort((a, b) => (b.debt > a.debt ? 1 : b.debt < a.debt ? -1 : 0)));
      })
      .catch(() => { if (!cancelled) setBorrowers([]); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetKey, vendorKey, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { borrowers, isLoading, refetch };
}
