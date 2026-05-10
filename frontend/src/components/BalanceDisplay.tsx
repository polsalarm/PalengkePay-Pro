import { useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { useWallet } from '../lib/hooks/useWallet';
import { useBalance } from '../lib/hooks/useBalance';

function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 5)  return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export function BalanceDisplay() {
  const { address } = useWallet();
  const { balance, isLoading, refetch } = useBalance(address);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setLastUpdated(new Date());
    setRefreshing(false);
  }, [refetch]);

  if (isLoading || (address && balance === null)) {
    return (
      <div className="text-center">
        <div className="h-8 w-40 skeleton rounded-lg mx-auto mb-1" />
        <div className="h-4 w-28 skeleton rounded mx-auto" />
      </div>
    );
  }

  if (!address) {
    return (
      <div className="text-center">
        <p className="text-3xl font-bold text-slate-300">—</p>
        <p className="text-xs text-slate-400 mt-1">Connect wallet to see balance</p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-2">
        <p className="text-3xl font-bold text-slate-900">
          {balance ?? '0.00'} <span className="text-teal-700">XLM</span>
        </p>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-slate-300 hover:text-teal-600 active:scale-95 transition-all disabled:opacity-40 mt-0.5"
          title="Refresh balance"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>
      <p className="text-xs text-slate-400 mt-1">
        {lastUpdated ? `Updated ${timeAgo(lastUpdated)}` : 'Available balance'}
      </p>
    </div>
  );
}
