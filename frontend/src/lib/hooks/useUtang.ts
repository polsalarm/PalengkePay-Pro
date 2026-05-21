import { useState, useEffect, useCallback } from 'react';
import {
  simulateViewCall, prepareContractTx, submitSorobanTx,
  buildPaymentTx, submitTx,
  addressToScVal, u64ToScVal, u32ToScVal, i128ToScVal, stringToScVal,
} from '../stellar';
import { StellarWalletsKit, Networks } from '@creit.tech/stellar-wallets-kit';
import { notifyWallet } from '../notify';

const ESCROW_ID = import.meta.env.VITE_UTANG_ESCROW_CONTRACT_ID as string | undefined;

export type UtangStatus = 'active' | 'completed' | 'defaulted';

export interface UtangRecord {
  id: bigint;
  customerWallet: string;
  vendorWallet: string;
  totalAmountXlm: number;      // converted from i128 stroops
  installmentAmountXlm: number;
  installmentsTotal: number;
  installmentsPaid: number;
  nextDueSecs: bigint;         // ledger timestamp (seconds)
  intervalDays: number;
  status: UtangStatus;
  description: string;
}

// Raw chain record (snake_case from scValToNative)
interface RawUtang {
  id: bigint;
  customer: string;
  vendor: string;
  total_amount: bigint;
  installment_amount: bigint;
  installments_total: number;
  installments_paid: number;
  next_due: bigint;
  interval_seconds: bigint;
  // Soroban enum variants without associated data come through scValToNative
  // in stellar-sdk@15 as a 1-element array (e.g. ["Defaulted"]). Older
  // SDKs returned { tag: "..." } or a plain string. Accept any shape so the
  // UI keeps working across SDK versions.
  status: string | string[] | { tag: string };
  description: string;
}

const STROOPS = 10_000_000;

function readStatusTag(s: RawUtang['status']): string {
  if (typeof s === 'string') return s;
  if (Array.isArray(s) && s.length > 0) return String(s[0]);
  if (s && typeof s === 'object' && 'tag' in s) return String(s.tag);
  return 'Active';
}

function mapUtang(raw: RawUtang): UtangRecord {
  const statusTag = readStatusTag(raw.status);
  const status: UtangStatus =
    statusTag === 'Completed' ? 'completed' :
    statusTag === 'Defaulted' ? 'defaulted' : 'active';

  return {
    id: raw.id,
    customerWallet: String(raw.customer),
    vendorWallet: String(raw.vendor),
    totalAmountXlm: Number(raw.total_amount) / STROOPS,
    installmentAmountXlm: Number(raw.installment_amount) / STROOPS,
    installmentsTotal: Number(raw.installments_total),
    installmentsPaid: Number(raw.installments_paid),
    nextDueSecs: raw.next_due,
    intervalDays: Math.round(Number(raw.interval_seconds) / 86400),
    status,
    description: String(raw.description ?? ''),
  };
}

async function fetchUtangs(method: string, wallet: string): Promise<UtangRecord[]> {
  if (!ESCROW_ID) throw new Error('Utang contract is not configured yet.');
  const raw = await simulateViewCall(ESCROW_ID, method, [
    addressToScVal(wallet),
    u32ToScVal(50),
    u32ToScVal(0),
  ]);
  if (!Array.isArray(raw)) return [];
  return (raw as RawUtang[]).map(mapUtang);
}

export function useVendorUtangs(vendorWallet: string | null) {
  const [utangs, setUtangs] = useState<UtangRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!vendorWallet) {
      setUtangs([]);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    fetchUtangs('get_vendor_utangs', vendorWallet)
      .then(setUtangs)
      .catch((err: unknown) => {
        setError((err as { message?: string }).message ?? 'Failed to load utang agreements');
        setUtangs([]);
      })
      .finally(() => setIsLoading(false));
  }, [vendorWallet, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { utangs, isLoading, error, refetch };
}

export function useCustomerUtangs(customerWallet: string | null) {
  const [utangs, setUtangs] = useState<UtangRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!customerWallet) {
      setUtangs([]);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    fetchUtangs('get_customer_utangs', customerWallet)
      .then(setUtangs)
      .catch((err: unknown) => {
        setError((err as { message?: string }).message ?? 'Failed to load utang agreements');
        setUtangs([]);
      })
      .finally(() => setIsLoading(false));
  }, [customerWallet, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { utangs, isLoading, error, refetch };
}

// ── Create utang ──────────────────────────────────────────────────────────────

export interface CreateUtangParams {
  vendorWallet: string;
  customerWallet: string;
  totalAmountXlm: number;
  installmentsTotal: number;
  intervalDays: number;
  description: string;
}

export function useCreateUtang() {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createUtang = useCallback(async (
    params: CreateUtangParams,
    signerAddress: string
  ): Promise<string | null> => {
    if (!ESCROW_ID) {
      setError('UTangEscrow contract is not configured. Set VITE_UTANG_ESCROW_CONTRACT_ID.');
      return null;
    }
    setIsCreating(true);
    setError(null);

    try {
      const totalStroops = BigInt(Math.round(params.totalAmountXlm * STROOPS));
      const intervalSecs = BigInt(params.intervalDays * 86400);

      const xdrStr = await prepareContractTx(signerAddress, ESCROW_ID, 'create_utang', [
        addressToScVal(params.vendorWallet),
        addressToScVal(params.customerWallet),
        i128ToScVal(totalStroops),
        u32ToScVal(params.installmentsTotal),
        u64ToScVal(intervalSecs),
        stringToScVal(params.description),
      ]);

      const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdrStr, {
        networkPassphrase: Networks.TESTNET,
        address: signerAddress,
      });

      const hash = await submitSorobanTx(signedTxXdr);
      return hash;
    } catch (err: unknown) {
      setError((err as { message?: string }).message ?? 'Failed to create utang');
      return null;
    } finally {
      setIsCreating(false);
    }
  }, []);

  return { createUtang, isCreating, error };
}

// ── Pay installment ───────────────────────────────────────────────────────────

export type InstallmentStatus = 'idle' | 'building' | 'signing' | 'submitting' | 'confirmed' | 'failed';

export function usePayInstallment() {
  const [status, setStatus] = useState<InstallmentStatus>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const payInstallment = useCallback(async (
    utang: UtangRecord,
    fromAddress: string
  ) => {
    setStatus('building');
    setTxHash(null);
    setError(null);

    try {
      if (ESCROW_ID) {
        // Full on-chain path via UTangEscrow contract
        const xdrStr = await prepareContractTx(fromAddress, ESCROW_ID, 'pay_installment', [
          addressToScVal(fromAddress),
          u64ToScVal(utang.id),
        ]);

        setStatus('signing');
        const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdrStr, {
          networkPassphrase: Networks.TESTNET,
          address: fromAddress,
        });

        setStatus('submitting');
        const hash = await submitSorobanTx(signedTxXdr);
        setTxHash(hash);
        setStatus('confirmed');
        const nextNum = utang.installmentsPaid + 1;
        const isFinal = nextNum >= utang.installmentsTotal;
        notifyWallet(utang.vendorWallet, {
          title: isFinal ? 'PalengkePay — utang tapos na!' : 'PalengkePay — installment bayad',
          body: isFinal
            ? `Customer fully paid: ${utang.description}`
            : `Installment ${nextNum}/${utang.installmentsTotal} received · ${utang.installmentAmountXlm.toFixed(2)} XLM · ${utang.description}`,
          tag: `utang-pay-${hash}`,
          url: '/vendor/utang',
        });
      } else {
        // Fallback: direct XLM transfer when contract not deployed
        const remaining = utang.installmentsTotal - utang.installmentsPaid;
        const totalPaid = utang.installmentAmountXlm * utang.installmentsPaid;
        const rest = utang.totalAmountXlm - totalPaid;
        const payAmount = remaining === 1 ? rest : utang.installmentAmountXlm;
        const memo = `Utang ${utang.installmentsPaid + 1}/${utang.installmentsTotal}`;

        const xdrStr = await buildPaymentTx(
          fromAddress,
          utang.vendorWallet,
          payAmount.toFixed(7),
          memo
        );

        setStatus('signing');
        const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdrStr, {
          networkPassphrase: Networks.TESTNET,
          address: fromAddress,
        });

        setStatus('submitting');
        const result = await submitTx(signedTxXdr);
        setTxHash(result.hash);
        setStatus('confirmed');
        const nextNum = utang.installmentsPaid + 1;
        const isFinal = nextNum >= utang.installmentsTotal;
        notifyWallet(utang.vendorWallet, {
          title: isFinal ? 'PalengkePay — utang tapos na!' : 'PalengkePay — installment bayad',
          body: isFinal
            ? `Customer fully paid: ${utang.description}`
            : `Installment ${nextNum}/${utang.installmentsTotal} received · ${payAmount.toFixed(2)} XLM · ${utang.description}`,
          tag: `utang-pay-${result.hash}`,
          url: '/vendor/utang',
        });
      }
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message ?? String(err);
      setError(
        msg.includes('rejected') || msg.includes('cancel')
          ? 'Transaction cancelled — no funds sent'
          : msg.slice(0, 120)
      );
      setStatus('failed');
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setTxHash(null);
    setError(null);
  }, []);

  return { status, txHash, error, payInstallment, reset };
}

// ── Due date helpers ──────────────────────────────────────────────────────────

export function dueLabel(nextDueSecs: bigint | null | undefined): string {
  if (!nextDueSecs) return '';
  const dueMs = Number(nextDueSecs) * 1000;
  const diffMs = dueMs - Date.now();
  const diffDays = Math.ceil(diffMs / 86400000);
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return 'due today';
  if (diffDays === 1) return 'due tomorrow';
  return `due in ${diffDays}d`;
}

export function isOverdue(nextDueSecs: bigint | null | undefined): boolean {
  if (!nextDueSecs) return false;
  return Number(nextDueSecs) * 1000 < Date.now();
}

// Days past next_due. Negative = future. Positive = overdue.
export function daysPastDue(nextDueSecs: bigint | null | undefined): number {
  if (!nextDueSecs) return 0;
  const diffMs = Date.now() - Number(nextDueSecs) * 1000;
  return Math.floor(diffMs / 86400000);
}

// Seconds past next_due. Negative = future. Positive = overdue.
// Use this when comparing against the contract's grace_period (which is in seconds).
export function secondsPastDue(nextDueSecs: bigint | null | undefined): number {
  if (!nextDueSecs) return 0;
  return Math.floor((Date.now() - Number(nextDueSecs) * 1000) / 1000);
}

// Format a grace_period in seconds to a short human label
// e.g. 604800 → "7d", 180 → "3m", 45 → "45s".
export function formatGraceSeconds(secs: number): string {
  if (!Number.isFinite(secs) || secs <= 0) return '0s';
  if (secs % 86400 === 0) return `${secs / 86400}d`;
  if (secs % 3600  === 0) return `${secs / 3600}h`;
  if (secs % 60    === 0) return `${secs / 60}m`;
  return `${secs}s`;
}

// Read the contract's current grace_period (seconds). Falls back to 7 d.
export function useUtangGracePeriod(): { gracePeriodSecs: number; isLoading: boolean } {
  const [gracePeriodSecs, setGracePeriodSecs] = useState<number>(7 * 86400);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!ESCROW_ID) { setIsLoading(false); return; }
    let cancelled = false;
    setIsLoading(true);
    simulateViewCall(ESCROW_ID, 'grace_period', [])
      .then((raw) => {
        if (cancelled) return;
        const n = Number(raw ?? 0);
        if (Number.isFinite(n) && n > 0) setGracePeriodSecs(n);
      })
      .catch(() => { /* keep fallback */ })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { gracePeriodSecs, isLoading };
}

// ── Default counters (view calls) ─────────────────────────────────────────────

export function useCustomerDefaults(wallet: string | null) {
  const [count, setCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!wallet || !ESCROW_ID) {
      setCount(0);
      return;
    }
    setIsLoading(true);
    simulateViewCall(ESCROW_ID, 'customer_defaults', [addressToScVal(wallet)])
      .then((raw) => setCount(Number(raw ?? 0)))
      .catch(() => setCount(0))
      .finally(() => setIsLoading(false));
  }, [wallet, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { count, isLoading, refetch };
}

export function useVendorDefaults(wallet: string | null) {
  const [count, setCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!wallet || !ESCROW_ID) {
      setCount(0);
      return;
    }
    setIsLoading(true);
    simulateViewCall(ESCROW_ID, 'vendor_defaults', [addressToScVal(wallet)])
      .then((raw) => setCount(Number(raw ?? 0)))
      .catch(() => setCount(0))
      .finally(() => setIsLoading(false));
  }, [wallet, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { count, isLoading, refetch };
}

// ── Admin: mark utang as defaulted ────────────────────────────────────────────

export function useMarkDefault() {
  const [isMarking, setIsMarking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const markDefault = useCallback(async (
    adminAddress: string,
    utangId: bigint
  ): Promise<string | null> => {
    if (!ESCROW_ID) {
      setError('UTangEscrow contract is not configured.');
      return null;
    }
    setIsMarking(true);
    setError(null);
    try {
      const xdrStr = await prepareContractTx(adminAddress, ESCROW_ID, 'mark_default', [
        addressToScVal(adminAddress),
        u64ToScVal(utangId),
      ]);
      const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdrStr, {
        networkPassphrase: Networks.TESTNET,
        address: adminAddress,
      });
      const hash = await submitSorobanTx(signedTxXdr);
      return hash;
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message ?? String(err);
      setError(msg.slice(0, 160));
      return null;
    } finally {
      setIsMarking(false);
    }
  }, []);

  return { markDefault, isMarking, error };
}

// ── Customer: resume defaulted utang by paying late fee ───────────────────────

export function useResumeAfterLate() {
  const [isResuming, setIsResuming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const resumeAfterLate = useCallback(async (
    customerAddress: string,
    utangId: bigint
  ): Promise<string | null> => {
    if (!ESCROW_ID) {
      setError('UTangEscrow contract is not configured.');
      return null;
    }
    setIsResuming(true);
    setError(null);
    setTxHash(null);
    try {
      const xdrStr = await prepareContractTx(customerAddress, ESCROW_ID, 'resume_after_late', [
        addressToScVal(customerAddress),
        u64ToScVal(utangId),
      ]);
      const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdrStr, {
        networkPassphrase: Networks.TESTNET,
        address: customerAddress,
      });
      const hash = await submitSorobanTx(signedTxXdr);
      setTxHash(hash);
      return hash;
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message ?? String(err);
      setError(
        msg.includes('rejected') || msg.includes('cancel')
          ? 'Transaction cancelled — no funds sent'
          : msg.slice(0, 160)
      );
      return null;
    } finally {
      setIsResuming(false);
    }
  }, []);

  return { resumeAfterLate, isResuming, error, txHash };
}
