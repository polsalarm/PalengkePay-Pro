import { useCallback, useEffect, useState } from 'react';
import { StellarWalletsKit, Networks } from '@creit.tech/stellar-wallets-kit';
import {
  simulateViewCall, prepareContractTx, submitSorobanTx,
  addressToScVal, bytes32ToScVal, u32ToScVal,
} from '../stellar';
import { summarize, type RatingSummary } from '../rating';

const REGISTRY_ID = import.meta.env.VITE_VENDOR_REGISTRY_CONTRACT_ID as string | undefined;

const summaryCache = new Map<string, RatingSummary>();
const ratedCache = new Map<string, boolean>(); // key: `${vendor}|${txHash}`

function ratedKey(vendor: string, txHash: string): string {
  return `${vendor}|${txHash}`;
}

export function useVendorRating(vendor: string | null) {
  const [summary, setSummary] = useState<RatingSummary | null>(
    vendor ? (summaryCache.get(vendor) ?? null) : null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!vendor || !REGISTRY_ID) return;
    let cancelled = false;
    setIsLoading(true);
    simulateViewCall(REGISTRY_ID, 'get_vendor_rating', [addressToScVal(vendor)])
      .then((raw) => {
        if (cancelled || !raw) return;
        const tuple = raw as [number | bigint, number | bigint];
        const s = summarize(Number(tuple[0] ?? 0), Number(tuple[1] ?? 0));
        summaryCache.set(vendor, s);
        setSummary(s);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [vendor, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { summary, isLoading, refetch };
}

export function useBulkVendorRatings(vendors: string[]) {
  const [summaries, setSummaries] = useState<Map<string, RatingSummary>>(() => {
    const m = new Map<string, RatingSummary>();
    for (const v of vendors) {
      const cached = summaryCache.get(v);
      if (cached) m.set(v, cached);
    }
    return m;
  });

  useEffect(() => {
    if (vendors.length === 0 || !REGISTRY_ID) return;
    let cancelled = false;
    Promise.all(
      vendors.map((v) =>
        simulateViewCall(REGISTRY_ID, 'get_vendor_rating', [addressToScVal(v)])
          .then((raw) => {
            const tuple = (raw ?? [0, 0]) as [number | bigint, number | bigint];
            return [v, summarize(Number(tuple[0] ?? 0), Number(tuple[1] ?? 0))] as const;
          })
          .catch(() => [v, summarize(0, 0)] as const),
      ),
    ).then((entries) => {
      if (cancelled) return;
      const m = new Map<string, RatingSummary>();
      for (const [v, s] of entries) {
        summaryCache.set(v, s);
        m.set(v, s);
      }
      setSummaries(m);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendors.join('|')]);

  return { summaries };
}

export function useHasRated(vendor: string | null, txHash: string | null) {
  const [hasRated, setHasRated] = useState<boolean | null>(
    vendor && txHash ? (ratedCache.get(ratedKey(vendor, txHash)) ?? null) : null,
  );

  useEffect(() => {
    if (!vendor || !txHash || !REGISTRY_ID) return;
    let cancelled = false;
    simulateViewCall(REGISTRY_ID, 'has_rated', [
      addressToScVal(vendor),
      bytes32ToScVal(txHash),
    ])
      .then((raw) => {
        if (cancelled) return;
        const b = Boolean(raw);
        ratedCache.set(ratedKey(vendor, txHash), b);
        setHasRated(b);
      })
      .catch(() => { if (!cancelled) setHasRated(false); });
    return () => { cancelled = true; };
  }, [vendor, txHash]);

  return hasRated;
}

export function useSubmitRating() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const submit = useCallback(async (
    customer: string,
    vendor: string,
    paymentTxHash: string,
    stars: number,
    commentHashHex: string,
  ): Promise<boolean> => {
    if (!REGISTRY_ID) { setError('VendorRegistry contract not deployed'); return false; }
    if (stars < 1 || stars > 5) { setError('Stars must be 1–5'); return false; }
    setIsSubmitting(true);
    setError(null);
    setTxHash(null);
    try {
      const xdr = await prepareContractTx(customer, REGISTRY_ID, 'submit_rating', [
        addressToScVal(customer),
        addressToScVal(vendor),
        bytes32ToScVal(paymentTxHash),
        u32ToScVal(stars),
        bytes32ToScVal(commentHashHex),
      ]);
      const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
        networkPassphrase: Networks.TESTNET,
        address: customer,
      });
      const hash = await submitSorobanTx(signedTxXdr);
      setTxHash(hash);
      summaryCache.delete(vendor);
      ratedCache.set(ratedKey(vendor, paymentTxHash), true);
      return true;
    } catch (err: unknown) {
      setError((err as { message?: string }).message ?? 'Rating failed');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return { submit, isSubmitting, error, txHash };
}
