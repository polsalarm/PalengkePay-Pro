import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpFromLine,
  CheckCircle2,
  Droplets,
  ExternalLink,
  Landmark,
  Loader2,
  Repeat,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useWallet } from '../../lib/hooks/useWallet';
import {
  creditLayerConfigured,
  poolId,
  toUnits,
  useCreditPool,
  useVaultActivity,
  useVaultBorrowers,
  type PoolAsset,
  type VaultActivityItem,
} from '../../lib/hooks/useCredit';
import { useAllVendors } from '../../lib/hooks/useVendor';
import { IS_MAINNET, stellarExpertUrl, truncateAddress } from '../../lib/stellar';
import { useToast } from '../../lib/hooks/useToast';

const NETWORK_LABEL = IS_MAINNET ? 'Mainnet' : 'Testnet';

function formatUnits(value: bigint): string {
  return toUnits(value).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatError(error: unknown): string {
  const message = (error as { message?: string })?.message ?? String(error);
  return message.length > 140 ? `${message.slice(0, 137)}...` : message;
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 0 || Number.isNaN(diffMs)) return '';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const ACTIVITY_META: Record<VaultActivityItem['type'], { label: string; icon: typeof Droplets; color: string; bg: string }> = {
  fund: { label: 'Funded', icon: Droplets, color: '#0D9488', bg: 'bg-teal-50' },
  draw: { label: 'Loan drawn', icon: ArrowDownToLine, color: '#DC2626', bg: 'bg-rose-50' },
  repay: { label: 'Repaid', icon: ArrowUpFromLine, color: '#059669', bg: 'bg-emerald-50' },
  collect: { label: 'Auto-repay', icon: Repeat, color: '#0369A1', bg: 'bg-sky-50' },
};

function PoolBalanceCard({ asset, poolBalance, active, onSelect }: {
  asset: PoolAsset;
  poolBalance: bigint;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left rounded-2xl p-4 transition-all ${
        active ? 'ring-2 ring-[#008055] bg-emerald-50' : 'ring-1 ring-slate-200 bg-white'
      }`}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{asset} pool liquidity</p>
      <p className="mt-1 text-2xl font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>
        {formatUnits(poolBalance)}
      </p>
    </button>
  );
}

export function AdminVault() {
  const navigate = useNavigate();
  const { address, isConnected, connect } = useWallet();
  const { showToast } = useToast();

  const availableAssets: PoolAsset[] = (['XLM', 'USDC'] as PoolAsset[]).filter((a) => Boolean(poolId(a)));
  const [asset, setAsset] = useState<PoolAsset>(() => (poolId('XLM') ? 'XLM' : 'USDC'));

  const poolXlm = useCreditPool(address, 'XLM');
  const poolUsdc = useCreditPool(address, 'USDC');
  const pools: Record<PoolAsset, ReturnType<typeof useCreditPool>> = { XLM: poolXlm, USDC: poolUsdc };
  const activePool = pools[asset];

  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const { items: activity, isLoading: activityLoading, error: activityError, refetch: refetchActivity } = useVaultActivity(availableAssets);
  const { vendors } = useAllVendors();
  const vendorNames = useMemo(() => new Map(vendors.map((v) => [v.wallet, v.name])), [vendors]);
  const { borrowers, isLoading: borrowersLoading, refetch: refetchBorrowers } = useVaultBorrowers(availableAssets, vendors);

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto animate-page-in">
        <div className="relative rounded-3xl overflow-hidden" style={{ backgroundColor: '#00284B' }}>
          <div className="relative p-10 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
              <Landmark size={28} className="text-white" />
            </div>
            <h1 className="text-xl font-black text-white mb-2" style={{ fontFamily: "'Montserrat', sans-serif" }}>Vault Funding</h1>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>Connect admin wallet to view pool liquidity and add funds</p>
            <button onClick={connect} className="font-black px-8 py-3 rounded-2xl active:scale-95 text-white" style={{ backgroundColor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}>
              Connect Wallet
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!creditLayerConfigured || availableAssets.length === 0) {
    return (
      <div className="max-w-2xl mx-auto space-y-5 animate-page-in">
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={20} />
            <div>
              <h2 className="font-black text-amber-950">{NETWORK_LABEL} vault is not configured</h2>
              <p className="mt-1 text-sm leading-6 text-amber-800">
                Add the {NETWORK_LABEL} registry and credit-pool contract IDs to the frontend environment before using this screen.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const submitDeposit = async () => {
    const units = Number(amount);
    if (!Number.isFinite(units) || units <= 0) {
      showToast('Enter an amount greater than zero', 'error');
      return;
    }
    setSubmitting(true);
    setTxHash(null);
    try {
      const hash = await activePool.deposit(units);
      setTxHash(hash);
      setAmount('');
      activePool.refetch();
      refetchActivity();
      showToast(`Added ${units.toFixed(2)} ${asset} to the ${NETWORK_LABEL} pool`, 'success');
    } catch (error) {
      showToast(formatError(error), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-4 animate-page-in">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/market')}
          className="w-10 h-10 rounded-2xl flex items-center justify-center active:scale-95 shrink-0 bg-slate-100 text-slate-600"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#008055]">{NETWORK_LABEL} finance</p>
          <h1 className="text-2xl font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>Vault Funding</h1>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500">
        <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#008055]" />
        <p>
          View-only pool liquidity per asset, plus the ability to top up a pool from this wallet. Funding is the same
          permissionless <code className="font-mono">deposit</code> call any liquidity provider uses — this page does not
          grant admin-only contract access, it just wraps it for operational use.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {availableAssets.map((a) => (
          <PoolBalanceCard
            key={a}
            asset={a}
            poolBalance={pools[a].poolBalance}
            active={asset === a}
            onSelect={() => { setAsset(a); setAmount(''); setTxHash(null); }}
          />
        ))}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="rounded-2xl bg-teal-50 p-3 text-teal-700"><Droplets size={20} /></div>
          <div>
            <h2 className="font-black text-slate-900">Add funds to the {asset} pool</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">Deposits from this wallet increase what vendors can draw.</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            className="min-w-0 flex-1 bg-transparent text-2xl font-black text-slate-900 outline-none"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          />
          <span className="text-sm font-black text-slate-400">{asset}</span>
        </div>
        <button
          type="button"
          onClick={submitDeposit}
          disabled={submitting}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#008055] to-[#0D9488] px-4 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-900/10 disabled:opacity-60"
        >
          {submitting ? <Loader2 size={17} className="animate-spin" /> : <Droplets size={17} />}
          {submitting ? 'Waiting for wallet...' : `Add ${asset} funds`}
        </button>
      </div>

      {txHash && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-emerald-900">Confirmed on {NETWORK_LABEL}</p>
            <p className="mt-0.5 truncate font-mono text-xs text-emerald-700">{truncateAddress(txHash)}</p>
          </div>
          <a href={stellarExpertUrl(txHash)} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-xs font-black text-emerald-700 hover:text-emerald-900">
            View <ExternalLink size={13} />
          </a>
        </div>
      )}

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-black text-slate-900">Borrowers</h2>
          <button
            type="button"
            onClick={refetchBorrowers}
            className="text-xs font-black text-[#008055] hover:text-[#006B4A] disabled:opacity-50"
            disabled={borrowersLoading}
          >
            {borrowersLoading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Registered vendors currently carrying an outstanding balance on a pool — live from each vendor's on-chain debt, not history.
        </p>

        {borrowersLoading && borrowers.length === 0 ? (
          <div className="mt-6 flex items-center justify-center py-6">
            <Loader2 size={22} className="animate-spin text-slate-300" />
          </div>
        ) : borrowers.length === 0 ? (
          <p className="mt-6 py-4 text-center text-sm text-slate-400">No vendor currently owes either pool.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {borrowers.map((b) => {
              const utilization = b.limit > 0n ? Math.min(100, Number((b.debt * 100n) / b.limit)) : 0;
              return (
                <div key={`${b.asset}-${b.wallet}`} className="flex items-center gap-3 rounded-2xl p-3 ring-1 ring-slate-100">
                  <div className="rounded-xl p-2.5 shrink-0 bg-rose-50 text-rose-600">
                    <Users size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-800">{b.name ?? truncateAddress(b.wallet)}</p>
                    <p className="text-xs text-slate-400">
                      {utilization}% of {formatUnits(b.limit)} {b.asset} limit used
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-black text-rose-600">{formatUnits(b.debt)}</p>
                    <p className="text-xs text-slate-400">{b.asset} owed</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-black text-slate-900">Vault activity</h2>
          <button
            type="button"
            onClick={refetchActivity}
            className="text-xs font-black text-[#008055] hover:text-[#006B4A] disabled:opacity-50"
            disabled={activityLoading}
          >
            {activityLoading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Who funded, borrowed, and repaid — sourced directly from on-chain contract events, not a database.
        </p>

        {activityError && (
          <div className="mt-4 flex gap-2 rounded-2xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" />
            <p>{activityError}</p>
          </div>
        )}

        {activityLoading && activity.length === 0 ? (
          <div className="mt-6 flex items-center justify-center py-6">
            <Loader2 size={22} className="animate-spin text-slate-300" />
          </div>
        ) : activity.length === 0 ? (
          <p className="mt-6 py-4 text-center text-sm text-slate-400">No vault activity found in the indexed window yet.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {activity.map((item) => {
              const meta = ACTIVITY_META[item.type];
              const Icon = meta.icon;
              const name = vendorNames.get(item.actor);
              return (
                <a
                  key={item.id}
                  href={stellarExpertUrl(item.txHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-2xl p-3 ring-1 ring-slate-100 hover:ring-slate-200 transition-all"
                >
                  <div className={`rounded-xl p-2.5 shrink-0 ${meta.bg}`} style={{ color: meta.color }}>
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-800">
                      {meta.label} <span className="text-slate-400 font-medium">· {item.asset}</span>
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {name ?? truncateAddress(item.actor)}
                      {item.type !== 'fund' && item.newDebt !== undefined && (
                        <> · debt now {formatUnits(item.newDebt)} {item.asset}</>
                      )}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-black" style={{ color: meta.color }}>{formatUnits(item.amount)}</p>
                    <p className="text-xs text-slate-400">{formatRelativeTime(item.closedAt)}</p>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
