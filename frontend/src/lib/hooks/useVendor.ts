import { useState, useEffect, useCallback } from 'react';
import {
  simulateViewCall, prepareContractTx, submitSorobanTx,
  addressToScVal, stringToScVal, u32ToScVal,
} from '../stellar';
import { StellarWalletsKit, Networks } from '@creit.tech/stellar-wallets-kit';

// Module-level cache so repeated renders don't re-fetch same address
const vendorNameCache = new Map<string, string>();

export interface VendorProfile {
  id: number;
  name: string;
  stallNumber: string;
  productType: string;
  marketId: string;
  phone: string;
  totalTransactions: number;
  totalVolume: bigint;
  isActive: boolean;
}

export interface VendorApplication {
  wallet: string;
  name: string;
  stallNumber: string;
  productType: string;
  marketId: string;
  phone: string;
  appliedAt: bigint;
  status: 'pending' | 'approved' | 'rejected';
}

const CONTRACT_ID = import.meta.env.VITE_VENDOR_REGISTRY_CONTRACT_ID as string | undefined;

function mapVendor(r: Record<string, unknown>): VendorProfile {
  return {
    id: Number(r.id),
    name: String(r.name ?? ''),
    stallNumber: String(r.stall_number ?? ''),
    productType: String(r.product_type ?? ''),
    marketId: String(r.market_id ?? ''),
    phone: String(r.phone ?? ''),
    totalTransactions: Number(r.total_transactions ?? 0),
    totalVolume: BigInt(String(r.total_volume ?? 0)),
    isActive: Boolean(r.is_active),
  };
}

function mapApplication(r: Record<string, unknown>): VendorApplication {
  const statusTag = (r.status as { tag?: string })?.tag ?? 'Pending';
  const status: VendorApplication['status'] =
    statusTag === 'Approved' ? 'approved' :
    statusTag === 'Rejected' ? 'rejected' : 'pending';
  return {
    wallet: String(r.wallet ?? ''),
    name: String(r.name ?? ''),
    stallNumber: String(r.stall_number ?? ''),
    productType: String(r.product_type ?? ''),
    marketId: String(r.market_id ?? ''),
    phone: String(r.phone ?? ''),
    appliedAt: BigInt(String(r.applied_at ?? 0)),
    status,
  };
}

// ── Resolve vendor name by address (with cache) ───────────────────────────────

export function useVendorName(address: string | null): string | null {
  const [name, setName] = useState<string | null>(
    address ? (vendorNameCache.get(address) ?? null) : null
  );

  useEffect(() => {
    if (!address || !CONTRACT_ID) return;
    if (vendorNameCache.has(address)) { setName(vendorNameCache.get(address)!); return; }
    simulateViewCall(CONTRACT_ID, 'get_vendor', [addressToScVal(address)])
      .then((raw) => {
        const n = String((raw as Record<string, unknown>)?.name ?? '');
        if (n) { vendorNameCache.set(address, n); setName(n); }
      })
      .catch(() => {});
  }, [address]);

  return name;
}

// ── Get single vendor ─────────────────────────────────────────────────────────

export function useVendor(walletAddress: string | null) {
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!walletAddress) { setVendor(null); return; }
    if (!CONTRACT_ID) { setNotFound(true); return; }

    setIsLoading(true);
    setNotFound(false);

    simulateViewCall(CONTRACT_ID, 'get_vendor', [addressToScVal(walletAddress)])
      .then((raw) => {
        if (!raw) { setNotFound(true); setVendor(null); return; }
        setVendor(mapVendor(raw as Record<string, unknown>));
      })
      .catch(() => { setNotFound(true); setVendor(null); })
      .finally(() => setIsLoading(false));
  }, [walletAddress]);

  return { vendor, isLoading, notFound };
}

// ── All registered vendors ────────────────────────────────────────────────────

export function useAllVendors() {
  const [vendors, setVendors] = useState<VendorProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!CONTRACT_ID) return;
    setIsLoading(true);
    setError(null);
    simulateViewCall(CONTRACT_ID, 'get_all_vendors', [u32ToScVal(50), u32ToScVal(0)])
      .then((raw) => {
        if (!Array.isArray(raw)) { setVendors([]); return; }
        setVendors((raw as Record<string, unknown>[]).map(mapVendor));
      })
      .catch((e: unknown) => {
        setVendors([]);
        setError((e as { message?: string }).message ?? 'Fetch failed');
      })
      .finally(() => setIsLoading(false));
  }, [tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { vendors, isLoading, error, refetch };
}

// ── Pending applications ──────────────────────────────────────────────────────

export function usePendingVendors() {
  const [applications, setApplications] = useState<VendorApplication[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!CONTRACT_ID) return;
    setIsLoading(true);
    setError(null);
    simulateViewCall(CONTRACT_ID, 'get_pending_vendors', [u32ToScVal(50), u32ToScVal(0)])
      .then((raw) => {
        if (!Array.isArray(raw)) { setApplications([]); return; }
        setApplications((raw as Record<string, unknown>[]).map(mapApplication));
      })
      .catch((e: unknown) => {
        setApplications([]);
        setError((e as { message?: string }).message ?? 'Fetch failed');
      })
      .finally(() => setIsLoading(false));
  }, [tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { applications, isLoading, error, refetch };
}

// ── Apply as vendor (self-service) ────────────────────────────────────────────

export function useApplyVendor() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const apply = useCallback(async (
    wallet: string,
    name: string,
    stallNumber: string,
    phone: string,
    productType: string,
    marketId = 'marikina-public-market',
  ): Promise<boolean> => {
    if (!CONTRACT_ID) { setError('VendorRegistry contract not deployed'); return false; }
    setIsSubmitting(true);
    setError(null);
    setTxHash(null);
    try {
      // Pre-check: already registered?
      const existing = await simulateViewCall(CONTRACT_ID, 'get_vendor', [addressToScVal(wallet)]).catch(() => null);
      if (existing) {
        setError('Already registered as vendor. Go to your vendor dashboard.');
        return false;
      }

      const xdr = await prepareContractTx(wallet, CONTRACT_ID, 'apply_vendor', [
        addressToScVal(wallet),
        stringToScVal(marketId),
        stringToScVal(name),
        stringToScVal(stallNumber),
        stringToScVal(phone),
        stringToScVal(productType),
      ]);
      const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
        networkPassphrase: Networks.TESTNET,
        address: wallet,
      });
      const hash = await submitSorobanTx(signedTxXdr);
      setTxHash(hash);
      return true;
    } catch (err: unknown) {
      setError((err as { message?: string }).message ?? 'Application failed');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return { apply, isSubmitting, error, txHash };
}

// ── Admin approve/reject ──────────────────────────────────────────────────────

export function useAdminActions() {
  const [loadingWallet, setLoadingWallet] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const approve = useCallback(async (adminAddress: string, vendorWallet: string): Promise<boolean> => {
    if (!CONTRACT_ID) return false;
    setLoadingWallet(vendorWallet);
    setError(null);
    try {
      const xdr = await prepareContractTx(adminAddress, CONTRACT_ID, 'approve_vendor', [
        addressToScVal(adminAddress),
        addressToScVal(vendorWallet),
      ]);
      const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
        networkPassphrase: Networks.TESTNET,
        address: adminAddress,
      });
      await submitSorobanTx(signedTxXdr);
      return true;
    } catch (err: unknown) {
      setError((err as { message?: string }).message ?? 'Approve failed');
      return false;
    } finally {
      setLoadingWallet(null);
    }
  }, []);

  const reject = useCallback(async (adminAddress: string, vendorWallet: string): Promise<boolean> => {
    if (!CONTRACT_ID) return false;
    setLoadingWallet(vendorWallet);
    setError(null);
    try {
      const xdr = await prepareContractTx(adminAddress, CONTRACT_ID, 'reject_vendor', [
        addressToScVal(adminAddress),
        addressToScVal(vendorWallet),
      ]);
      const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
        networkPassphrase: Networks.TESTNET,
        address: adminAddress,
      });
      await submitSorobanTx(signedTxXdr);
      return true;
    } catch (err: unknown) {
      setError((err as { message?: string }).message ?? 'Reject failed');
      return false;
    } finally {
      setLoadingWallet(null);
    }
  }, []);

  const deactivate = useCallback(async (adminAddress: string, vendorWallet: string): Promise<boolean> => {
    if (!CONTRACT_ID) return false;
    setLoadingWallet(vendorWallet);
    setError(null);
    try {
      const xdr = await prepareContractTx(adminAddress, CONTRACT_ID, 'deactivate_vendor', [
        addressToScVal(adminAddress),
        addressToScVal(vendorWallet),
      ]);
      const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
        networkPassphrase: Networks.TESTNET,
        address: adminAddress,
      });
      await submitSorobanTx(signedTxXdr);
      // Invalidate name cache for this vendor
      vendorNameCache.delete(vendorWallet);
      return true;
    } catch (err: unknown) {
      setError((err as { message?: string }).message ?? 'Deactivate failed');
      return false;
    } finally {
      setLoadingWallet(null);
    }
  }, []);

  return { approve, reject, deactivate, loadingWallet, error };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export async function isRegisteredVendor(walletAddress: string): Promise<boolean> {
  if (!CONTRACT_ID) return false;
  try {
    const result = await simulateViewCall(CONTRACT_ID, 'get_vendor', [addressToScVal(walletAddress)]);
    return result !== null;
  } catch {
    return false;
  }
}
