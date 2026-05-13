import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Zap, TrendingUp, BarChart2, Clock, ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';
import { useMetrics } from '../../lib/hooks/useMetrics';
import { useWallet } from '../../lib/hooks/useWallet';

const PRODUCT_EMOJIS: Record<string, string> = {
  fish: '🐟', meat: '🥩', vegetables: '🥦', fruits: '🍎',
  'rice & grains': '🌾', spices: '🌶️', other: '🛒',
};

const PRODUCT_COLORS: Record<string, string> = {
  fish: '#3B82F6', meat: '#EF4444', vegetables: '#22C55E',
  fruits: '#F97316', 'rice & grains': '#EAB308', spices: '#A855F7', other: '#94A3B8',
};

const REFRESH_SECS = 30;
const DONUT_R = 54;
const DONUT_C = 2 * Math.PI * DONUT_R;

// ── Donut chart ───────────────────────────────────────────────────────────────

function DonutChart({ data, center }: {
  data: { type: string; pct: number; color: string }[];
  center: { label: string; value: string };
}) {
  let cumPct = 0;
  return (
    <svg viewBox="0 0 130 130" style={{ width: 130, height: 130, flexShrink: 0 }}>
      {/* Track */}
      <circle cx={65} cy={65} r={DONUT_R} fill="none" stroke="#F1F5F9" strokeWidth={18} />
      {data.map(({ type, pct, color }) => {
        if (pct === 0) { cumPct += pct; return null; }
        const gap = data.length > 1 ? 2 : 0;
        const dashLen = Math.max(0, (pct / 100) * DONUT_C - gap);
        const offset = DONUT_C - (cumPct / 100) * DONUT_C;
        cumPct += pct;
        return (
          <circle
            key={type}
            cx={65} cy={65} r={DONUT_R}
            fill="none"
            stroke={color}
            strokeWidth={18}
            strokeDasharray={`${dashLen} ${DONUT_C - dashLen}`}
            strokeDashoffset={offset}
            strokeLinecap="butt"
            transform="rotate(-90 65 65)"
            style={{ transition: 'stroke-dasharray 0.6s ease, stroke-dashoffset 0.6s ease' }}
          />
        );
      })}
      {/* Center hole */}
      <circle cx={65} cy={65} r={43} fill="white" />
      {/* Center text */}
      <text
        x={65} y={61}
        textAnchor="middle"
        style={{ fontSize: 20, fontWeight: 900, fill: '#0F172A', fontFamily: "'Syne', sans-serif" }}
      >
        {center.value}
      </text>
      <text
        x={65} y={76}
        textAnchor="middle"
        style={{ fontSize: 9.5, fontWeight: 700, fill: '#94A3B8', letterSpacing: 0.5 }}
      >
        {center.label.toUpperCase()}
      </text>
    </svg>
  );
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ points, color = '#14B8A6' }: { points: number[]; color?: string }) {
  if (points.length < 2) {
    return <div style={{ width: 80, height: 28, opacity: 0.3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>building…</span>
    </div>;
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const W = 80, H = 28, pad = 2;
  const xs = points.map((_, i) => pad + (i / (points.length - 1)) * (W - pad * 2));
  const ys = points.map((v) => pad + (1 - (v - min) / range) * (H - pad * 2));
  const linePts = xs.map((x, i) => `${x},${ys[i]}`).join(' ');
  const areaPts = `${xs[0]},${H} ${linePts} ${xs[xs.length - 1]},${H}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: W, height: H }}>
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPts} fill="url(#sparkGrad)" />
      <polyline points={linePts} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {/* Last point dot */}
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r={2.5} fill={color} />
    </svg>
  );
}

// ── Countdown ring ────────────────────────────────────────────────────────────

function CountdownRing({ secs, total }: { secs: number; total: number }) {
  const r = 11, c = 2 * Math.PI * r;
  const progress = (secs / total) * c;
  return (
    <svg viewBox="0 0 28 28" style={{ width: 28, height: 28 }}>
      <circle cx={14} cy={14} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={2.5} />
      <circle
        cx={14} cy={14} r={r}
        fill="none"
        stroke="rgba(20,184,166,0.7)"
        strokeWidth={2.5}
        strokeDasharray={`${progress} ${c - progress}`}
        strokeDashoffset={c / 4}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s linear' }}
      />
      <text x={14} y={18} textAnchor="middle" style={{ fontSize: 8, fontWeight: 700, fill: 'rgba(255,255,255,0.5)' }}>
        {secs}
      </text>
    </svg>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className="bg-white rounded-3xl p-5" style={{ border: '1.5px solid #F1F5F9' }}>
      <div
        className="w-10 h-10 rounded-2xl flex items-center justify-center mb-4"
        style={{ backgroundColor: color + '18' }}
      >
        <Icon size={18} style={{ color }} />
      </div>
      <p className="text-2xl font-black text-slate-900" style={{ fontFamily: "'Syne', sans-serif" }}>{value}</p>
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function AdminMetrics() {
  const navigate = useNavigate();
  const { isConnected, connect } = useWallet();
  const { summary, productBreakdown, topVendors, metricsSource, isLoading, error, refetch } = useMetrics();

  const [countdown, setCountdown] = useState(REFRESH_SECS);
  const cdRef = useRef(REFRESH_SECS);
  const [volHistory, setVolHistory] = useState<number[]>([]);
  const [txHistory, setTxHistory] = useState<number[]>([]);
  const [barAnimated, setBarAnimated] = useState(false);

  // Auto-refresh + countdown
  useEffect(() => {
    cdRef.current = REFRESH_SECS;
    setCountdown(REFRESH_SECS);

    const refreshId = setInterval(() => {
      refetch();
      cdRef.current = REFRESH_SECS;
      setCountdown(REFRESH_SECS);
    }, REFRESH_SECS * 1000);

    const tickId = setInterval(() => {
      cdRef.current = Math.max(0, cdRef.current - 1);
      setCountdown(cdRef.current);
    }, 1000);

    return () => { clearInterval(refreshId); clearInterval(tickId); };
  }, [refetch]);

  // Track volume + tx history for sparklines
  useEffect(() => {
    if (!isLoading && summary.totalTransactions >= 0) {
      setVolHistory((p) => [...p.slice(-9), summary.totalVolumeXlm]);
      setTxHistory((p) => [...p.slice(-9), summary.totalTransactions]);
    }
  }, [isLoading, summary.totalVolumeXlm, summary.totalTransactions]);

  // Animate bars when data loads
  useEffect(() => {
    if (!isLoading && topVendors.length > 0) {
      setBarAnimated(false);
      const t = setTimeout(() => setBarAnimated(true), 80);
      return () => clearTimeout(t);
    }
  }, [isLoading, topVendors]);

  const maxVolume = topVendors.length > 0 ? topVendors[0].volumeXlm || 1 : 1;
  const donutData = productBreakdown.map(({ type, pct }) => ({
    type, pct, color: PRODUCT_COLORS[type] ?? '#94A3B8',
  }));

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto animate-page-in">
        <div className="relative rounded-3xl overflow-hidden" style={{ backgroundColor: '#0A3D38' }}>
          <div className="absolute pointer-events-none" style={{ top: -60, right: -40, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(20,184,166,0.3) 0%, transparent 65%)', filter: 'blur(50px)' }} />
          <div className="relative p-10 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
              <ShieldCheck size={28} className="text-white" />
            </div>
            <h1 className="text-xl font-black text-white mb-2" style={{ fontFamily: "'Syne', sans-serif" }}>Metrics Dashboard</h1>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>Connect admin wallet to view live metrics</p>
            <button onClick={connect} className="font-black px-8 py-3 rounded-2xl active:scale-95 text-white" style={{ backgroundColor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}>
              Connect Wallet
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-page-in">

      {/* Hero */}
      <div className="relative rounded-3xl overflow-hidden" style={{ backgroundColor: '#0A3D38' }}>
        <div className="absolute inset-0 pointer-events-none opacity-[0.04]" style={{ backgroundImage: `repeating-linear-gradient(45deg, white 0px, white 1px, transparent 1px, transparent 12px), repeating-linear-gradient(-45deg, white 0px, white 1px, transparent 1px, transparent 12px)` }} />
        <div className="absolute pointer-events-none" style={{ top: -60, right: -40, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(20,184,166,0.3) 0%, transparent 65%)', filter: 'blur(50px)' }} />

        <div className="relative p-5">
          {/* Header row */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => navigate('/admin/market')}
                className="w-10 h-10 rounded-2xl flex items-center justify-center active:scale-95 shrink-0"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
              >
                <ArrowLeft size={16} className="text-white" />
              </button>
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                <BarChart2 size={20} className="text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-black text-white truncate" style={{ fontFamily: "'Syne', sans-serif" }}>Metrics Dashboard</h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {metricsSource === 'palengke-payment' ? 'PalengkePayment records' : 'Registry fallback'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Countdown ring + manual refresh */}
              <button onClick={() => { refetch(); cdRef.current = REFRESH_SECS; setCountdown(REFRESH_SECS); }} className="active:scale-95 transition-all">
                <CountdownRing secs={countdown} total={REFRESH_SECS} />
              </button>
            </div>
          </div>

          {/* Vendor stats + sparkline */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: 'Active', value: isLoading ? '…' : String(summary.activeVendors) },
              { label: 'Pending', value: isLoading ? '…' : String(summary.pendingVendors) },
              { label: 'Total', value: isLoading ? '…' : String(summary.totalVendors) },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-2xl p-3 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                <p className="text-xl font-black text-white" style={{ fontFamily: "'Syne', sans-serif" }}>{value}</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</p>
              </div>
            ))}
          </div>

          {/* Live sparklines row */}
          {(volHistory.length > 0 || txHistory.length > 0) && (
            <div className="flex items-center justify-between rounded-2xl px-4 py-2" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
              <div className="flex flex-col gap-0.5">
                <p className="text-xs font-black text-white" style={{ fontFamily: "'Syne', sans-serif" }}>
                  {summary.totalVolumeXlm.toFixed(2)} XLM
                </p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Total volume</p>
              </div>
              <Sparkline points={volHistory} color="#14B8A6" />
              <div className="w-px h-8 mx-2" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
              <div className="flex flex-col gap-0.5 text-right">
                <p className="text-xs font-black text-white" style={{ fontFamily: "'Syne', sans-serif" }}>
                  {summary.totalTransactions}
                </p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Transactions</p>
              </div>
              <Sparkline points={txHistory} color="#A78BFA" />
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ backgroundColor: '#FFF1F2', border: '1.5px solid #FECDD3' }}>
          <AlertTriangle size={16} style={{ color: '#F43F5E' }} />
          <p className="text-sm font-semibold" style={{ color: '#F43F5E' }}>{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin" style={{ color: '#0F766E' }} />
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={TrendingUp} label="Total XLM Processed" value={summary.totalVolumeXlm.toFixed(2)} sub="XLM on Testnet" color="#0F766E" />
            <StatCard icon={Zap} label="Total Transactions" value={String(summary.totalTransactions)} sub="all-time payments" color="#7C3AED" />
            <StatCard icon={Users} label="Active Vendors" value={`${summary.activeVendors}/${summary.totalVendors}`} sub={`${summary.totalVendors - summary.activeVendors} inactive`} color="#0369A1" />
            <StatCard icon={Clock} label="Avg Tx Size" value={summary.avgTxXlm > 0 ? summary.avgTxXlm.toFixed(3) : '—'} sub="XLM per payment" color="#D97706" />
          </div>

          {/* Donut chart: vendor categories */}
          {productBreakdown.length > 0 && (
            <div className="bg-white rounded-3xl overflow-hidden" style={{ border: '1.5px solid #F1F5F9' }}>
              <div className="px-5 pt-4 pb-2">
                <p className="text-xs font-black uppercase tracking-widest" style={{ color: '#94A3B8' }}>Vendor Categories</p>
              </div>
              <div className="flex items-center gap-4 px-5 pb-5">
                {/* Donut */}
                <DonutChart
                  data={donutData}
                  center={{ value: String(summary.totalVendors), label: 'vendors' }}
                />
                {/* Legend */}
                <div className="flex-1 min-w-0 space-y-2">
                  {productBreakdown.map(({ type, count, pct, volumeXlm }) => {
                    const color = PRODUCT_COLORS[type] ?? '#94A3B8';
                    return (
                      <div key={type} className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700 capitalize truncate">
                              {PRODUCT_EMOJIS[type] ?? '🛒'} {type}
                            </span>
                            <span className="text-xs font-black ml-2 shrink-0" style={{ color }}>{pct}%</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ backgroundColor: '#F1F5F9' }}>
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: barAnimated ? `${pct}%` : '0%',
                                  backgroundColor: color,
                                  transition: 'width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                }}
                              />
                            </div>
                            <span className="text-xs text-slate-400 shrink-0">{count}v · {volumeXlm.toFixed(1)} XLM</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Top vendors bar chart */}
          {topVendors.length > 0 && (
            <div className="bg-white rounded-3xl overflow-hidden" style={{ border: '1.5px solid #F1F5F9' }}>
              <div className="px-5 pt-4 pb-1">
                <p className="text-xs font-black uppercase tracking-widest" style={{ color: '#94A3B8' }}>Top Vendors by Volume</p>
              </div>
              <div className="px-5 pb-5 space-y-3 mt-2">
                {topVendors.map((v, i) => {
                  const widthPct = Math.round((v.volumeXlm / maxVolume) * 100);
                  const prodColor = PRODUCT_COLORS[v.productType] ?? '#94A3B8';
                  return (
                    <div key={v.name + v.stallNumber}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                            style={{
                              backgroundColor: i === 0 ? '#FDE68A' : i === 1 ? '#E2E8F0' : '#F8FAFC',
                              color: i === 0 ? '#92400E' : '#64748B',
                            }}
                          >
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">{v.name}</p>
                            <p className="text-xs text-slate-400">
                              {PRODUCT_EMOJIS[v.productType] ?? '🛒'} {v.productType} · {v.totalTransactions} txn
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-black shrink-0 ml-2" style={{ color: '#0F766E' }}>
                          {v.volumeXlm.toFixed(2)} XLM
                        </span>
                      </div>
                      {/* Stacked bar: product color + remaining */}
                      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#F1F5F9' }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: barAnimated ? `${widthPct}%` : '0%',
                            background: `linear-gradient(90deg, ${prodColor} 0%, #0F766E 100%)`,
                            transition: `width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 80}ms`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {productBreakdown.length === 0 && topVendors.length === 0 && (
            <div className="rounded-3xl p-10 text-center" style={{ border: '1.5px solid #F1F5F9' }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#F8FAFC' }}>
                <BarChart2 size={24} style={{ color: '#CBD5E1' }} />
              </div>
              <p className="text-sm font-bold text-slate-500">No vendor data yet</p>
              <p className="text-xs text-slate-400 mt-1">Approve vendors to see metrics</p>
            </div>
          )}
        </>
      )}

      <p className="text-center text-xs pb-2" style={{ color: '#94A3B8' }}>
        {metricsSource === 'palengke-payment' ? 'Live from PalengkePayment records' : 'Using registry fallback'} · Stellar Testnet · refreshes every {REFRESH_SECS}s
      </p>
    </div>
  );
}
