import { useState, useEffect, useCallback } from 'react';
import {
  NETWORK_PASSPHRASE,
  IS_MAINNET,
  simulateViewCall, prepareContractTx, submitSorobanTx, getLatestLedgerSequence,
  addressToScVal, i128ToScVal, u32ToScVal, u64ToScVal,
} from '../stellar';
import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit';

// Credit RWA layer points at the v2 registry (which exposes get_credit_score) and
// the two score-gated lending pools. Kept separate from the app's primary registry
// env so the rest of the app is undisturbed.
const REGISTRY_V2 = import.meta.env.VITE_VENDOR_REGISTRY_V2_CONTRACT_ID as string | undefined;
const POOL_USDC = import.meta.env.VITE_CREDIT_POOL_USDC_CONTRACT_ID as string | undefined;
const POOL_XLM = import.meta.env.VITE_CREDIT_POOL_XLM_CONTRACT_ID as string | undefined;
const USDC_SAC = import.meta.env.VITE_USDC_SAC_CONTRACT_ID as string | undefined;
const XLM_SAC = import.meta.env.VITE_XLM_SAC_CONTRACT_ID as string | undefined;

// The credit RWA layer is deliberately Testnet-only while the pool economics,
// repayment UX, and liquidity-provider workflow are being validated.
export const creditLayerConfigured = !IS_MAINNET && !!(REGISTRY_V2 && (POOL_USDC || POOL_XLM));

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
    if (!address || !REGISTRY_V2) { setScore(null); return; }
    setIsLoading(true);
    simulateViewCall(REGISTRY_V2, 'get_credit_score', [addressToScVal(address)])
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
