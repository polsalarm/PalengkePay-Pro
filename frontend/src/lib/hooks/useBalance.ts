import { useState, useEffect, useCallback } from 'react';
import { fetchBalance } from '../stellar';

export function useBalance(address: string | null) {
  const [balance, setBalance] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!address) {
      setBalance(null);
      return;
    }
    setIsLoading(true);
    try {
      const bal = await fetchBalance(address);
      setBalance(bal);
    } catch {
      setBalance(null);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    refetch();
    if (!address) return;
    const interval = setInterval(refetch, 30000);
    return () => clearInterval(interval);
  }, [address, refetch]);

  return { balance, isLoading, refetch };
}
