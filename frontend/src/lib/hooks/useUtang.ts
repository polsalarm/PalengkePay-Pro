import { useState, useEffect, useCallback } from 'react';
import {
  simulateViewCall, prepareContractTx, submitSorobanTx,
  buildPaymentTx, submitTx,
  addressToScVal, u64ToScVal, u32ToScVal, i128ToScVal, stringToScVal,
} from '../stellar';
import { StellarWalletsKit, Networks } from '@creit.tech/stellar-wallets-kit';

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
  status: { tag: string };
  description: string;
}

const STROOPS = 10_000_000;

function mapUtang(raw: RawUtang): UtangRecord {
  const statusTag = raw.status?.tag ?? 'Active';
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
  if (!ESCROW_ID) return [];
  try {
    const raw = await simulateViewCall(ESCROW_ID, method, [
      addressToScVal(wallet),
      u32ToScVal(50),
      u32ToScVal(0),
    ]);
    if (!Array.isArray(raw)) return [];
    return (raw as RawUtang[]).map(mapUtang);
  } catch {
    return [];
  }
}

export function useVendorUtangs(vendorWallet: string | null) {
  const [utangs, setUtangs] = useState<UtangRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!vendorWallet) return;
    setIsLoading(true);
    fetchUtangs('get_vendor_utangs', vendorWallet)
      .then(setUtangs)
      .finally(() => setIsLoading(false));
  }, [vendorWallet, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { utangs, isLoading, refetch };
}

export function useCustomerUtangs(customerWallet: string | null) {
  const [utangs, setUtangs] = useState<UtangRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!customerWallet) return;
    setIsLoading(true);
    fetchUtangs('get_customer_utangs', customerWallet)
      .then(setUtangs)
      .finally(() => setIsLoading(false));
  }, [customerWallet, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { utangs, isLoading, refetch };
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
      setError('Deploy VTangEscrow contract first. Set VITE_UTANG_ESCROW_CONTRACT_ID.');
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
