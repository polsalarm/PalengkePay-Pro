import { useCallback, useEffect, useState } from 'react';
import { StellarWalletsKit, Networks } from '@creit.tech/stellar-wallets-kit';
import {
  buildSetStatusXdr, fetchVendorStatus, submitSignedStatus, type VendorStatus,
} from '../vendorStatus';

// Module cache so cards in MarketDirectory don't refetch repeatedly
const cache = new Map<string, VendorStatus>();

export function useVendorStatus(address: string | null) {
  const [status, setStatus] = useState<VendorStatus | null>(
    address ? (cache.get(address) ?? null) : null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!address) { setStatus(null); return; }
    let cancelled = false;
    setIsLoading(true);
    fetchVendorStatus(address)
      .then((s) => {
        if (cancelled) return;
        cache.set(address, s);
        setStatus(s);
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [address, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { status, isLoading, refetch };
}

export function useToggleVendorStatus(address: string | null) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = useCallback(async (nextIsOpen: boolean): Promise<boolean> => {
    if (!address) { setError('No wallet connected'); return false; }
    setIsPending(true);
    setError(null);
    try {
      const xdr = await buildSetStatusXdr(address, nextIsOpen);
      const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
        networkPassphrase: Networks.TESTNET,
        address,
      });
      await submitSignedStatus(signedTxXdr);
      cache.set(address, { isOpen: nextIsOpen, defaulted: false });
      return true;
    } catch (err: unknown) {
      setError((err as { message?: string }).message ?? 'Toggle failed');
      return false;
    } finally {
      setIsPending(false);
    }
  }, [address]);

  return { toggle, isPending, error };
}

export function clearVendorStatusCache(address?: string) {
  if (address) cache.delete(address);
  else cache.clear();
}

export function useBulkVendorStatuses(addresses: string[]) {
  const [statuses, setStatuses] = useState<Map<string, VendorStatus>>(() => {
    const m = new Map<string, VendorStatus>();
    for (const a of addresses) {
      const cached = cache.get(a);
      if (cached) m.set(a, cached);
    }
    return m;
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (addresses.length === 0) return;
    let cancelled = false;
    setIsLoading(true);
    Promise.all(
      addresses.map((a) =>
        fetchVendorStatus(a).then((s) => [a, s] as const).catch(() => [a, { isOpen: true, defaulted: true } as VendorStatus] as const),
      ),
    ).then((entries) => {
      if (cancelled) return;
      const m = new Map<string, VendorStatus>();
      for (const [a, s] of entries) {
        cache.set(a, s);
        m.set(a, s);
      }
      setStatuses(m);
    }).finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses.join('|')]);

  return { statuses, isLoading };
}
