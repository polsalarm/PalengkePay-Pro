import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Landmark, Loader2, ArrowDownToLine, ArrowUpFromLine, ShieldCheck } from 'lucide-react';
import {
  useCreditScore, useCreditPool, scoreTier, toUnits,
  creditLayerConfigured, type PoolAsset,
} from '../lib/hooks/useCredit';
import { useToast } from '../lib/hooks/useToast';

const SCORE_MIN = 300;
const SCORE_MAX = 850;

function fmt(stroops: bigint): string {
  return toUnits(stroops).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface Props {
  address: string;
}

/**
 * Working-capital card — the RWA credit story made visible. Shows the vendor's
 * on-chain credit score and lets them draw / repay score-gated working capital
 * from the USDC or XLM lending pool.
 */
export function CreditCard({ address }: Props) {
  const { score, isLoading: scoreLoading, refetch: refetchScore } = useCreditScore(address);
  const [asset, setAsset] = useState<PoolAsset>('USDC');
  const pool = useCreditPool(address, asset);
  const { showToast } = useToast();

  const [mode, setMode] = useState<'draw' | 'repay' | null>(null);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!creditLayerConfigured) return null;

  const s = score ?? SCORE_MIN;
  const tier = scoreTier(s);
  const pct = Math.max(0, Math.min(1, (s - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)));

  const availableUnits = toUnits(pool.available);
  const debtUnits = toUnits(pool.debt);

  const openPanel = (m: 'draw' | 'repay') => {
    setMode(m);
    setAmount(m === 'draw'
      ? (availableUnits > 0 ? String(Math.floor(availableUnits)) : '')
      : (debtUnits > 0 ? String(debtUnits.toFixed(2)) : ''));
  };

  const confirm = async () => {
    const units = parseFloat(amount);
    if (!units || units <= 0) { showToast('Enter an amount', 'error'); return; }
    if (mode === 'draw' && units > availableUnits + 1e-9) {
      showToast(`Max available is ${availableUnits.toFixed(2)} ${asset}`, 'error');
      return;
    }
    setSubmitting(true);
    try {
      if (mode === 'draw') await pool.draw(units);
      else await pool.repay(units);
      showToast(
        mode === 'draw'
          ? `Drew ${units.toFixed(2)} ${asset} working capital`
          : `Repaid ${units.toFixed(2)} ${asset}`,
        'success',
      );
      setMode(null);
      setAmount('');
      pool.refetch();
      refetchScore();
    } catch (err: unknown) {
      showToast((err as { message?: string }).message ?? 'Transaction failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-4 mt-3">
      <div className="rounded-3xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1.5px solid #F1F5F9' }}>
        {/* Header */}
        <div
          className="relative p-5"
          style={{ background: 'linear-gradient(135deg, #00284B 0%, #0D5C4A 100%)', overflow: 'clip' }}
        >
          <div
            className="absolute pointer-events-none"
            style={{
              top: -50, right: -40, width: 200, height: 200, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(20,184,166,0.30) 0%, transparent 65%)', filter: 'blur(40px)',
            }}
          />
          <div className="relative flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Landmark size={16} style={{ color: '#5EEAD4' }} />
              <span className="text-sm font-black text-white" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                Working Capital
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ backgroundColor: 'rgba(94,234,212,0.15)', color: '#5EEAD4' }}
              >
                <ShieldCheck size={10} /> On-chain credit
              </span>
              <Link to="/vendor/vault" className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-black text-white hover:bg-white/20">
                Open Vault
              </Link>
            </div>
          </div>

          {/* Score */}
          <div className="relative flex items-end justify-between mb-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Credit score
              </p>
              {scoreLoading ? (
                <div className="h-9 w-24 skeleton rounded-lg" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-white leading-none" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                    {s}
                  </span>
                  <span className="text-sm font-bold" style={{ color: tier.color }}>{tier.label}</span>
                </div>
              )}
            </div>
            <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {SCORE_MIN}–{SCORE_MAX}
            </span>
          </div>

          {/* Gauge */}
          <div className="relative h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct * 100}%`, background: `linear-gradient(90deg, #F59E0B, ${tier.color})` }}
            />
          </div>
          <p className="relative text-[11px] mt-2.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Built from your sales volume, ratings, and on-time repayment.
          </p>
        </div>

        {/* Asset toggle */}
        <div className="flex gap-2 p-4 pb-0">
          {(['USDC', 'XLM'] as PoolAsset[]).map((a) => (
            <button
              key={a}
              onClick={() => setAsset(a)}
              className="flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
              style={asset === a
                ? { backgroundColor: '#0D5C4A', color: '#fff' }
                : { backgroundColor: '#F1F5F9', color: '#64748B' }}
            >
              {a}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 p-4">
          {[
            { label: 'Credit line', value: fmt(pool.limit) },
            { label: 'Available', value: fmt(pool.available), accent: '#059669' },
            { label: 'Owed', value: fmt(pool.debt), accent: debtUnits > 0 ? '#DC2626' : undefined },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl p-3" style={{ backgroundColor: '#F8FAFC' }}>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">{stat.label}</p>
              <p className="text-sm font-black leading-tight truncate" style={{ color: stat.accent ?? '#0F172A', fontFamily: "'Montserrat', sans-serif" }}>
                {pool.isLoading ? '—' : stat.value}
              </p>
              <p className="text-[10px] text-slate-400">{asset}</p>
            </div>
          ))}
        </div>

        {/* Actions */}
        {mode === null ? (
          <div className="flex gap-2 px-4 pb-4">
            <button
              onClick={() => openPanel('draw')}
              disabled={availableUnits <= 0}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-black text-white transition-all active:scale-95 disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #008055 0%, #0D9488 100%)', fontFamily: "'Montserrat', sans-serif" }}
            >
              <ArrowDownToLine size={16} /> Draw
            </button>
            <button
              onClick={() => openPanel('repay')}
              disabled={debtUnits <= 0}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-black transition-all active:scale-95 disabled:opacity-40"
              style={{ backgroundColor: '#FEF3C7', color: '#B45309', fontFamily: "'Montserrat', sans-serif" }}
            >
              <ArrowUpFromLine size={16} /> Repay
            </button>
          </div>
        ) : (
          <div className="px-4 pb-4">
            <div className="rounded-2xl p-3" style={{ backgroundColor: '#F8FAFC', border: '1.5px solid #E2E8F0' }}>
              <p className="text-xs font-bold text-slate-600 mb-2">
                {mode === 'draw' ? `Draw working capital (${asset})` : `Repay (${asset})`}
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                  className="flex-1 bg-white rounded-xl px-3 py-2.5 text-base font-black text-slate-900 outline-none"
                  style={{ border: '1.5px solid #CBD5E1', fontFamily: "'Montserrat', sans-serif" }}
                />
                <span className="text-sm font-bold text-slate-400">{asset}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                {mode === 'draw'
                  ? `Max ${availableUnits.toFixed(2)} ${asset}`
                  : `Outstanding ${debtUnits.toFixed(2)} ${asset}`}
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => { setMode(null); setAmount(''); }}
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-500 active:scale-95"
                  style={{ backgroundColor: '#F1F5F9' }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirm}
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black text-white active:scale-95 disabled:opacity-60"
                  style={{ background: mode === 'draw' ? 'linear-gradient(135deg, #008055, #0D9488)' : '#B45309', fontFamily: "'Montserrat', sans-serif" }}
                >
                  {submitting ? <Loader2 size={15} className="animate-spin" /> : <TrendingUp size={15} />}
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
