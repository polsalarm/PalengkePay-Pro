import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  Droplets,
  ExternalLink,
  Info,
  Landmark,
  Loader2,
  RefreshCw,
  Repeat,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import { useWallet } from '../../lib/hooks/useWallet';
import {
  creditLayerConfigured,
  poolId,
  scoreTier,
  SCHEDULE_PRESETS,
  toUnits,
  type PoolAsset,
  useAutoRepay,
  useCreditPool,
  useCreditScore,
} from '../../lib/hooks/useCredit';
import { IS_MAINNET, stellarExpertUrl, truncateAddress } from '../../lib/stellar';
import { useToast } from '../../lib/hooks/useToast';
import { WalletRequiredState } from '../../components/WalletRequiredState';

type VaultTab = 'borrow' | 'provide';
type BorrowAction = 'draw' | 'repay' | null;

const SCORE_MIN = 300;
const SCORE_MAX = 850;
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

function intervalLabel(seconds: bigint): string {
  const preset = SCHEDULE_PRESETS.find((p) => BigInt(p.seconds) === seconds);
  if (preset) return preset.label;
  const days = Number(seconds) / 86_400;
  return `Every ${days % 1 === 0 ? days : days.toFixed(1)}d`;
}

function formatNextDue(nextDue: bigint): string {
  const diffMs = Number(nextDue) * 1000 - Date.now();
  if (diffMs <= 0) return 'Due now';
  const days = Math.floor(diffMs / 86_400_000);
  if (days >= 1) return `in ${days}d`;
  const hours = Math.max(1, Math.floor(diffMs / 3_600_000));
  return `in ${hours}h`;
}

function Stat({ label, value, asset, accent }: { label: string; value: string; asset?: PoolAsset; accent?: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1 truncate text-xl font-black" style={{ color: accent ?? '#0F172A', fontFamily: "'Montserrat', sans-serif" }}>
        {value}
      </p>
      {asset && <p className="text-[10px] font-bold text-slate-400">{asset}</p>}
    </div>
  );
}

export function VendorVault() {
  const { address } = useWallet();
  const { showToast } = useToast();
  const availableAssets: PoolAsset[] = (['XLM', 'USDC'] as PoolAsset[]).filter((asset) => Boolean(poolId(asset)));
  const [asset, setAsset] = useState<PoolAsset>(() => (poolId('XLM') ? 'XLM' : 'USDC'));
  const [tab, setTab] = useState<VaultTab>('borrow');
  const [borrowAction, setBorrowAction] = useState<BorrowAction>(null);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const [showAutoRepayForm, setShowAutoRepayForm] = useState(false);
  const [intervalSeconds, setIntervalSeconds] = useState<number>(SCHEDULE_PRESETS[0].seconds);
  const [perPeriodAmount, setPerPeriodAmount] = useState('');
  const [autoRepaySubmitting, setAutoRepaySubmitting] = useState(false);

  const { score, isLoading: scoreLoading, refetch: refetchScore } = useCreditScore(address);
  const pool = useCreditPool(address, asset);
  const autoRepay = useAutoRepay(address, asset);

  if (!address) {
    return <WalletRequiredState detail={`Connect your ${NETWORK_LABEL} wallet to open the Vendor Vault.`} />;
  }

  if (!creditLayerConfigured || availableAssets.length === 0) {
    return (
      <div className="space-y-5">
        <Header />
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={20} />
            <div>
              <h2 className="font-black text-amber-950">{NETWORK_LABEL} Vault is not configured</h2>
              <p className="mt-1 text-sm leading-6 text-amber-800">
                Add the {NETWORK_LABEL} registry and credit-pool contract IDs to the frontend environment before using this screen.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentScore = score ?? SCORE_MIN;
  const tier = scoreTier(currentScore);
  const scorePercent = Math.max(0, Math.min(1, (currentScore - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)));
  const available = toUnits(pool.available);
  const debt = toUnits(pool.debt);

  const openBorrowAction = (action: Exclude<BorrowAction, null>) => {
    setBorrowAction(action);
    setAmount(action === 'draw'
      ? (available > 0 ? String(Math.floor(available)) : '')
      : (debt > 0 ? debt.toFixed(2) : ''));
    setTxHash(null);
  };

  const submitBorrowAction = async () => {
    const units = Number(amount);
    if (!Number.isFinite(units) || units <= 0) {
      showToast('Enter an amount greater than zero', 'error');
      return;
    }
    if (borrowAction === 'draw' && units > available + 1e-9) {
      showToast(`Maximum available is ${available.toFixed(2)} ${asset}`, 'error');
      return;
    }
    setSubmitting(true);
    setTxHash(null);
    try {
      const hash = borrowAction === 'draw' ? await pool.draw(units) : await pool.repay(units);
      setTxHash(hash);
      setBorrowAction(null);
      setAmount('');
      pool.refetch();
      refetchScore();
      showToast(borrowAction === 'draw' ? `Drew ${units.toFixed(2)} ${asset}` : `Repaid ${units.toFixed(2)} ${asset}`, 'success');
    } catch (error) {
      showToast(formatError(error), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const submitDeposit = async () => {
    const units = Number(amount);
    if (!Number.isFinite(units) || units <= 0) {
      showToast('Enter a deposit greater than zero', 'error');
      return;
    }
    setSubmitting(true);
    setTxHash(null);
    try {
      const hash = await pool.deposit(units);
      setTxHash(hash);
      setAmount('');
      pool.refetch();
      showToast(`Deposited ${units.toFixed(2)} ${asset} into the ${NETWORK_LABEL} pool`, 'success');
    } catch (error) {
      showToast(formatError(error), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const changeAsset = (next: PoolAsset) => {
    setAsset(next);
    setAmount('');
    setBorrowAction(null);
    setTxHash(null);
    setShowAutoRepayForm(false);
    setPerPeriodAmount('');
  };

  const allowanceLow = Boolean(
    autoRepay.schedule && autoRepay.allowance < autoRepay.schedule.amount_per_period,
  );

  const submitEnableAutoRepay = async () => {
    const perPeriodUnits = Number(perPeriodAmount);
    if (!Number.isFinite(perPeriodUnits) || perPeriodUnits <= 0) {
      showToast('Enter an amount greater than zero', 'error');
      return;
    }
    setAutoRepaySubmitting(true);
    try {
      // Cap covers ~12 periods so a few missed cron ticks don't strand it
      // needing renewal right away.
      await autoRepay.enable(intervalSeconds, perPeriodUnits, perPeriodUnits * 12);
      setShowAutoRepayForm(false);
      setPerPeriodAmount('');
      showToast('Auto-repay enabled', 'success');
    } catch (error) {
      showToast(formatError(error), 'error');
    } finally {
      setAutoRepaySubmitting(false);
    }
  };

  const submitCancelAutoRepay = async () => {
    setAutoRepaySubmitting(true);
    try {
      await autoRepay.cancel();
      showToast('Auto-repay cancelled', 'success');
    } catch (error) {
      showToast(formatError(error), 'error');
    } finally {
      setAutoRepaySubmitting(false);
    }
  };

  return (
    <div className="space-y-5 pb-4">
      <Header />

      <section className="relative overflow-hidden rounded-[2rem] p-6 text-white" style={{ background: 'linear-gradient(135deg, #00284B 0%, #0D5C4A 68%, #0F766E 100%)' }}>
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-teal-300/20 blur-3xl" />
        <div className="relative">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-teal-200">Vendor Vault - {NETWORK_LABEL}</p>
              <h1 className="max-w-lg text-3xl font-black leading-tight" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                Your daily sales can open the next door.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/65">
                Borrow working capital against your on-chain sales history, or help fund the pool that keeps local vendors moving.
              </p>
            </div>
            <div className="hidden rounded-2xl border border-white/15 bg-white/10 p-3 sm:block">
              <Landmark size={24} className="text-teal-200" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">Credit score</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-black" style={{ fontFamily: "'Montserrat', sans-serif" }}>{scoreLoading ? '--' : currentScore}</span>
                <span className="text-xs font-black" style={{ color: tier.color }}>{tier.label}</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full" style={{ width: `${scorePercent * 100}%`, background: `linear-gradient(90deg, #F59E0B, ${tier.color})` }} />
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">Available to draw</p>
              <p className="mt-1 text-3xl font-black" style={{ fontFamily: "'Montserrat', sans-serif" }}>{formatUnits(pool.available)}</p>
              <p className="text-xs font-bold text-teal-200">{asset} - pool liquidity capped</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">Outstanding</p>
              <p className="mt-1 text-3xl font-black" style={{ fontFamily: "'Montserrat', sans-serif" }}>{formatUnits(pool.debt)}</p>
              <p className="text-xs font-bold text-white/50">{asset} principal</p>
            </div>
          </div>
        </div>
      </section>

      <div className="flex gap-2 rounded-2xl bg-slate-100 p-1.5" role="tablist" aria-label="Vault actions">
        <button type="button" role="tab" aria-selected={tab === 'borrow'} onClick={() => { setTab('borrow'); setAmount(''); setBorrowAction(null); }} className={`flex-1 rounded-xl px-3 py-3 text-sm font-black transition-all ${tab === 'borrow' ? 'bg-white text-[#006B4A] shadow-sm' : 'text-slate-500'}`}>
          Borrow working capital
        </button>
        <button type="button" role="tab" aria-selected={tab === 'provide'} onClick={() => { setTab('provide'); setAmount(''); setBorrowAction(null); }} className={`flex-1 rounded-xl px-3 py-3 text-sm font-black transition-all ${tab === 'provide' ? 'bg-white text-[#006B4A] shadow-sm' : 'text-slate-500'}`}>
          Provide liquidity
        </button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {availableAssets.map((item) => (
            <button key={item} type="button" onClick={() => changeAsset(item)} className={`rounded-full px-4 py-2 text-xs font-black transition-all ${asset === item ? 'bg-[#0D5C4A] text-white shadow-sm' : 'bg-white text-slate-500 ring-1 ring-slate-200'}`}>
              {item} pool
            </button>
          ))}
        </div>
        <button type="button" onClick={() => { pool.refetch(); refetchScore(); }} className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-[#008055]" aria-label="Refresh vault data">
          <RefreshCw size={16} />
        </button>
      </div>

      {tab === 'borrow' ? (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Credit line" value={formatUnits(pool.limit)} asset={asset} />
            <Stat label="Pool liquidity" value={formatUnits(pool.poolBalance)} asset={asset} accent="#059669" />
            <Stat label="Your debt" value={formatUnits(pool.debt)} asset={asset} accent={debt > 0 ? '#DC2626' : undefined} />
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700"><WalletCards size={20} /></div>
              <div>
                <h2 className="font-black text-slate-900">Borrow for the next market day</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">Your limit is calculated from sales volume, ratings, and repayment history. The pool can only lend what is currently available.</p>
              </div>
            </div>

            {!borrowAction ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button type="button" disabled={available <= 0} onClick={() => openBorrowAction('draw')} className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#008055] to-[#0D9488] px-4 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-900/10 transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40">
                  <ArrowDownToLine size={17} /> Draw {asset}
                </button>
                <button type="button" disabled={debt <= 0} onClick={() => openBorrowAction('repay')} className="flex items-center justify-center gap-2 rounded-2xl bg-amber-50 px-4 py-3.5 text-sm font-black text-amber-700 transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40">
                  <ArrowUpFromLine size={17} /> Repay {asset}
                </button>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-slate-800">{borrowAction === 'draw' ? `Draw ${asset}` : `Repay ${asset}`}</p>
                  <button type="button" onClick={() => { setBorrowAction(null); setAmount(''); }} className="text-xs font-bold text-slate-400 hover:text-slate-700">Cancel</button>
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                  <input type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" autoFocus className="min-w-0 flex-1 bg-transparent text-2xl font-black text-slate-900 outline-none" style={{ fontFamily: "'Montserrat', sans-serif" }} />
                  <span className="text-sm font-black text-slate-400">{asset}</span>
                </div>
                <p className="mt-2 text-xs text-slate-400">{borrowAction === 'draw' ? `Maximum ${available.toFixed(2)} ${asset}` : `Outstanding ${debt.toFixed(2)} ${asset}`}</p>
                <button type="button" onClick={submitBorrowAction} disabled={submitting} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0D5C4A] px-4 py-3.5 text-sm font-black text-white disabled:opacity-60">
                  {submitting ? <Loader2 size={17} className="animate-spin" /> : <ShieldCheck size={17} />}
                  {submitting ? 'Waiting for wallet...' : 'Confirm in wallet'}
                </button>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-teal-50 p-3 text-teal-700"><Repeat size={20} /></div>
              <div>
                <h2 className="font-black text-slate-900">Auto-repay</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Skim a fixed amount from your wallet on a schedule instead of repaying by hand.
                  You approve a capped allowance once — the pool can never pull more than that.
                </p>
              </div>
            </div>

            {autoRepay.schedule ? (
              <div className="mt-5 space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Stat label="Cadence" value={intervalLabel(autoRepay.schedule.interval_seconds)} />
                  <Stat label="Per period" value={formatUnits(autoRepay.schedule.amount_per_period)} asset={asset} />
                  <Stat label="Next pull" value={formatNextDue(autoRepay.schedule.next_due)} />
                </div>
                {allowanceLow && (
                  <div className="flex gap-2 rounded-2xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" />
                    <p>
                      Remaining allowance ({formatUnits(autoRepay.allowance)} {asset}) is below your next
                      pull amount — the next auto-repay may fail. Set up again below to top it up.
                    </p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={submitCancelAutoRepay}
                  disabled={autoRepaySubmitting}
                  className="w-full rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-700 disabled:opacity-60"
                >
                  {autoRepaySubmitting ? 'Cancelling…' : 'Cancel auto-repay'}
                </button>
              </div>
            ) : !showAutoRepayForm ? (
              <button
                type="button"
                onClick={() => setShowAutoRepayForm(true)}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-50 px-4 py-3.5 text-sm font-black text-teal-700"
              >
                <Repeat size={17} /> Set up auto-repay
              </button>
            ) : (
              <div className="mt-5 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <div className="flex gap-2">
                  {SCHEDULE_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setIntervalSeconds(preset.seconds)}
                      className={`flex-1 rounded-xl py-2 text-xs font-black transition-all ${intervalSeconds === preset.seconds ? 'bg-[#0D5C4A] text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200'}`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={perPeriodAmount}
                    onChange={(event) => setPerPeriodAmount(event.target.value)}
                    placeholder="0.00"
                    className="min-w-0 flex-1 bg-transparent text-2xl font-black text-slate-900 outline-none"
                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                  />
                  <span className="text-sm font-black text-slate-400">{asset} / period</span>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Needs 2 signatures: one to approve the pull allowance, one to set the schedule.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAutoRepayForm(false)}
                    className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-500 ring-1 ring-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submitEnableAutoRepay}
                    disabled={autoRepaySubmitting}
                    className="rounded-2xl bg-[#0D5C4A] px-4 py-3 text-sm font-black text-white disabled:opacity-60"
                  >
                    {autoRepaySubmitting ? 'Confirm in wallet…' : 'Enable'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          <div className="rounded-3xl border border-teal-100 bg-gradient-to-br from-teal-50 to-white p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-white p-3 text-[#0D5C4A] shadow-sm"><Droplets size={20} /></div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0D9488]">Liquidity provider</p>
                <h2 className="mt-1 text-xl font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>Keep the market moving</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">Deposit {NETWORK_LABEL} {asset} into the on-chain pool. Eligible vendors can draw from this liquidity when their credit line allows it.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Stat label="Current pool balance" value={formatUnits(pool.poolBalance)} asset={asset} accent="#0D5C4A" />
              <Stat label="Vendor capacity right now" value={formatUnits(pool.available)} asset={asset} accent="#059669" />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Landmark size={18} className="text-[#008055]" />
              <h2 className="font-black text-slate-900">Add liquidity to the {asset} pool</h2>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <input type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" className="min-w-0 flex-1 bg-transparent text-2xl font-black text-slate-900 outline-none" style={{ fontFamily: "'Montserrat', sans-serif" }} />
              <span className="text-sm font-black text-slate-400">{asset}</span>
            </div>
            <button type="button" onClick={submitDeposit} disabled={submitting} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#008055] to-[#0D9488] px-4 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-900/10 disabled:opacity-60">
              {submitting ? <Loader2 size={17} className="animate-spin" /> : <Droplets size={17} />}
              {submitting ? 'Waiting for wallet...' : `Deposit ${asset}`}
            </button>
            <div className="mt-4 flex gap-2 rounded-2xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
              <Info size={15} className="mt-0.5 shrink-0 text-amber-600" />
              <p><strong>{NETWORK_LABEL} prototype:</strong> this pool currently supports deposits and vendor lending, but does not yet expose withdrawal or yield accounting. Use {NETWORK_LABEL} funds only.</p>
            </div>
          </div>
        </section>
      )}

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

      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500">
        <Info size={15} className="mt-0.5 shrink-0 text-[#008055]" />
        <p><strong className="text-slate-700">How this works:</strong> the contract reads your score from the {NETWORK_LABEL} vendor registry, limits borrowing to the pool's available balance, and requires your wallet to authorize every draw, repayment, or deposit.</p>
      </div>

      <Link to="/vendor/home" className="inline-flex items-center gap-2 text-sm font-black text-[#008055] hover:text-[#006B4A]">Back to vendor home</Link>
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#008055]">{NETWORK_LABEL} finance</p>
        <h1 className="mt-1 text-2xl font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>Vendor Vault</h1>
        <p className="mt-1 text-sm text-slate-500">Borrow against your track record. Help fund someone else's next stall day.</p>
      </div>
      <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-black text-emerald-700">
        <ShieldCheck size={13} /> {NETWORK_LABEL} only
      </div>
    </div>
  );
}
