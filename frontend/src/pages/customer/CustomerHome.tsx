import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanLine, ExternalLink, AlertTriangle, HandCoins, Store, ShoppingBag, ArrowRight, TrendingDown, ChevronRight } from 'lucide-react';
import { useWallet } from '../../lib/hooks/useWallet';
import { useBalance } from '../../lib/hooks/useBalance';
import { useCustomerTransactions, relativeTime } from '../../lib/hooks/useTransactions';
import type { TxRecord } from '../../lib/hooks/useTransactions';
import { useCustomerUtangs, isOverdue } from '../../lib/hooks/useUtang';
import { truncateAddress, stellarExpertUrl } from '../../lib/stellar';
import { useVendorName } from '../../lib/hooks/useVendor';

const STRINGS = {
  en: {
    balance: 'Wallet Balance',
    totalSpent: 'Total Spent',
    transactions: 'Transactions',
    utangBalance: 'Utang Balance',
    utangOverdue: 'Overdue Utang!',
    overdueDesc: (n: number) => `${n} agreement${n > 1 ? 's' : ''} overdue`,
    activeDesc: (n: number) => `${n} active agreement${n > 1 ? 's' : ''}`,
    scanBtn: 'Scan to Pay',
    scanSub: 'Aim at any PalengkePay QR',
    vendors: 'Find Vendors',
    vendorsSub: 'Browse market',
    history: 'History',
    historySub: 'Past payments',
    recentPayments: 'Recent Payments',
    viewAll: 'View all',
    emptyTitle: 'No payments yet',
    emptyDesc: 'Scan a vendor QR to get started',
    scanNow: 'Scan Now',
    notConnected: 'Not connected',
  },
  tl: {
    balance: 'Iyong Balanse',
    totalSpent: 'Kabuuang Gastos',
    transactions: 'Mga Transaksyon',
    utangBalance: 'Utang Balance',
    utangOverdue: 'May Overdue na Utang!',
    overdueDesc: (n: number) => `${n} kasunduan ang overdue`,
    activeDesc: (n: number) => `${n} aktibong kasunduan`,
    scanBtn: 'I-Scan at Bayaran',
    scanSub: 'I-aim sa QR ng kahit anong vendor',
    vendors: 'Mga Vendor',
    vendorsSub: 'I-browse ang palengke',
    history: 'Kasaysayan',
    historySub: 'Mga nakaraang bayad',
    recentPayments: 'Mga Huling Bayad',
    viewAll: 'Lahat',
    emptyTitle: 'Wala pang bayad',
    emptyDesc: 'I-scan ang QR ng vendor para magsimula',
    scanNow: 'I-scan Ngayon',
    notConnected: 'Hindi nakakonekta',
  },
};

function groupByDate(txs: TxRecord[], lang: 'en' | 'tl') {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const groups: { label: string; txs: TxRecord[] }[] = [];
  const buckets: Record<string, TxRecord[]> = {};
  for (const tx of txs) {
    const d = new Date(tx.createdAt); d.setHours(0, 0, 0, 0);
    const key = d.getTime() === today.getTime()
      ? (lang === 'tl' ? 'Ngayon' : 'Today')
      : d.getTime() === yesterday.getTime()
        ? (lang === 'tl' ? 'Kahapon' : 'Yesterday')
        : d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(tx);
  }
  for (const [label, list] of Object.entries(buckets)) groups.push({ label, txs: list });
  return groups;
}

function RecentTxRow({ tx }: { tx: TxRecord }) {
  const vendorName = useVendorName(tx.to);
  return (
    <div className="flex items-center justify-between py-3 px-3 rounded-2xl transition-colors active:bg-slate-50">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: '#FFF1F2' }}
        >
          <TrendingDown size={16} style={{ color: '#F43F5E' }} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-800 truncate leading-tight">
            {vendorName || truncateAddress(tx.to)}
          </p>
          {tx.memo && (
            <p className="text-xs font-semibold truncate mt-0.5" style={{ color: '#008055' }}>{tx.memo}</p>
          )}
          <p className="text-xs text-slate-400 mt-0.5">{relativeTime(tx.createdAt)}</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 ml-2">
        <div className="text-right">
          <span className="text-sm font-black block" style={{ color: '#F43F5E', fontFamily: "'Montserrat', sans-serif" }}>
            -{tx.amountXlm.toFixed(2)}
          </span>
          <span className="text-xs text-slate-400">XLM</span>
        </div>
        <a
          href={stellarExpertUrl(tx.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-lg"
          style={{ color: '#CBD5E1' }}
        >
          <ExternalLink size={13} />
        </a>
      </div>
    </div>
  );
}

export function CustomerHome() {
  const navigate = useNavigate();
  const { address } = useWallet();
  const { balance } = useBalance(address);
  const { transactions, isLoading } = useCustomerTransactions(address);
  const { utangs } = useCustomerUtangs(address);
  const [lang, setLang] = useState<'en' | 'tl'>('tl');
  const t = STRINGS[lang];

  const activeUtangs = utangs.filter((u) => u.status === 'active');
  const totalOwed = activeUtangs.reduce((sum, u) => {
    const paid = u.installmentAmountXlm * u.installmentsPaid;
    return sum + Math.max(0, u.totalAmountXlm - paid);
  }, 0);
  const overdueCount = activeUtangs.filter((u) => isOverdue(u.nextDueSecs)).length;
  const recent = transactions.slice(0, 10);
  const groups = groupByDate(recent, lang);
  const totalSpent = transactions.reduce((s, tx) => s + tx.amountXlm, 0);

  const balanceNum = balance ? parseFloat(balance) : null;
  const balanceStr = balanceNum !== null ? balanceNum.toFixed(2) : '—';
  const balanceFontSize = balanceStr.length >= 10 ? '1.6rem' : balanceStr.length >= 8 ? '2rem' : balanceStr.length >= 6 ? '2.6rem' : '3.2rem';

  return (
    <div className="animate-page-in" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>

      {/* ── BALANCE HERO ── */}
      <div
        className="relative mx-4 mt-4 rounded-3xl"
        style={{ backgroundColor: '#00284B', overflow: 'clip' }}
      >
        {/* Banig-weave diagonal texture */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage: `repeating-linear-gradient(
              45deg,
              white 0px, white 1px,
              transparent 1px, transparent 12px
            ), repeating-linear-gradient(
              -45deg,
              white 0px, white 1px,
              transparent 1px, transparent 12px
            )`,
          }}
        />
        {/* Ambient glow */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: -60, right: -60, width: 260, height: 260, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(20,184,166,0.35) 0%, transparent 65%)',
            filter: 'blur(50px)',
          }}
        />
        {/* ₱ watermark */}
        <div
          className="absolute select-none pointer-events-none font-black"
          style={{
            fontSize: '12rem', lineHeight: 1,
            color: 'rgba(255,255,255,0.04)',
            bottom: -20, right: -10,
            fontFamily: "'Montserrat', sans-serif",
          }}
        >₱</div>

        <div className="relative p-5 pb-6">
          {/* Top row: label + lang toggle */}
          <div className="flex items-center justify-between mb-3">
            <p
              className="text-xs font-bold uppercase tracking-[0.18em]"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >{t.balance}</p>

            {/* Language toggle */}
            <div
              className="flex items-center rounded-full p-0.5"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
            >
              {(['en', 'tl'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className="text-xs font-bold px-3 py-1 rounded-full transition-all"
                  style={lang === l
                    ? { backgroundColor: '#008055', color: 'white' }
                    : { color: 'rgba(255,255,255,0.45)' }
                  }
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Balance number — font scales down for long numbers */}
          <div className="mb-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span
                className="font-black text-white leading-none"
                style={{
                  fontSize: balanceFontSize,
                  fontFamily: "'Montserrat', sans-serif",
                  letterSpacing: '-0.02em',
                  lineHeight: 1.05,
                }}
              >
                {balanceStr}
              </span>
              <span
                className="text-base font-bold shrink-0"
                style={{ color: 'rgba(255,255,255,0.35)', fontFamily: "'Montserrat', sans-serif" }}
              >XLM</span>
            </div>
          </div>

          <p
            className="text-xs font-mono mb-5 truncate"
            style={{ color: 'rgba(255,255,255,0.22)' }}
          >
            {address ? truncateAddress(address) : t.notConnected}
          </p>

          {/* Stats row */}
          <div
            className="grid grid-cols-2 gap-4 pt-4"
            style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
          >
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{t.totalSpent}</p>
              <p
                className="text-base font-black text-white leading-tight"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              >
                {totalSpent.toFixed(2)} <span className="text-xs font-semibold opacity-50">XLM</span>
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{t.transactions}</p>
              <p
                className="text-base font-black text-white leading-tight"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              >
                {transactions.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── UTANG ALERT ── */}
      {activeUtangs.length > 0 && (
        <button
          onClick={() => navigate('/customer/utang')}
          className="w-full text-left mt-3 px-4 active:scale-95 transition-transform"
        >
          <div
            className="rounded-2xl p-4"
            style={overdueCount > 0
              ? { backgroundColor: '#FFF1F2', border: '2.5px solid #F43F5E', boxShadow: '0 0 0 4px rgba(244,63,94,0.1)' }
              : { backgroundColor: '#FFFBEB', border: '2px solid #FDE68A' }
            }
          >
            <div className="flex items-center gap-3">
              {/* Icon */}
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                style={overdueCount > 0 ? { backgroundColor: '#FFE4E6' } : { backgroundColor: '#FEF3C7' }}
              >
                {overdueCount > 0
                  ? <AlertTriangle size={20} style={{ color: '#F43F5E' }} className="animate-pulse" />
                  : <HandCoins size={20} style={{ color: '#D97706' }} />
                }
              </div>

              {/* Label + amount in one column */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-black text-slate-800 leading-tight truncate" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                    {overdueCount > 0 ? t.utangOverdue : t.utangBalance}
                  </p>
                  <p
                    className="font-black leading-tight shrink-0"
                    style={{
                      fontSize: '1rem',
                      fontFamily: "'Montserrat', sans-serif",
                      color: overdueCount > 0 ? '#F43F5E' : '#92400E',
                    }}
                  >
                    {totalOwed.toFixed(2)} <span className="text-xs font-semibold opacity-70">XLM</span>
                  </p>
                </div>
                <p className="text-xs font-semibold mt-0.5" style={{ color: overdueCount > 0 ? '#F43F5E' : '#92400E' }}>
                  {overdueCount > 0 ? t.overdueDesc(overdueCount) : t.activeDesc(activeUtangs.length)}
                </p>
              </div>

              <ChevronRight size={16} className="shrink-0" style={{ color: overdueCount > 0 ? '#F43F5E' : '#D97706' }} />
            </div>
          </div>
        </button>
      )}

      {/* ── SCAN TO PAY — PRIMARY CTA ── */}
      <div className="px-4 mt-3">
        <button
          onClick={() => navigate('/customer/scan')}
          className="w-full relative overflow-hidden flex items-center gap-4 text-white rounded-3xl transition-all active:scale-95"
          style={{
            backgroundColor: '#008055',
            minHeight: '76px',
            padding: '0 20px',
            boxShadow: '0 8px 32px rgba(15,118,110,0.4)',
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none opacity-10"
            style={{
              backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          />
          <div
            className="absolute right-0 top-0 bottom-0 w-32 pointer-events-none"
            style={{ background: 'linear-gradient(to left, rgba(20,184,166,0.4), transparent)' }}
          />
          <div className="relative shrink-0">
            <div
              className="absolute inset-0 rounded-2xl animate-ping opacity-20"
              style={{ backgroundColor: 'rgba(255,255,255,0.4)' }}
            />
            <div
              className="relative w-13 h-13 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: 'rgba(255,255,255,0.18)', width: 52, height: 52 }}
            >
              <ScanLine size={26} />
            </div>
          </div>
          <div className="relative text-left flex-1 min-w-0">
            <p
              className="font-black text-lg leading-tight"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              {t.scanBtn}
            </p>
            <p className="text-sm mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {t.scanSub}
            </p>
          </div>
          <ArrowRight size={20} style={{ color: 'rgba(255,255,255,0.5)' }} className="shrink-0" />
        </button>
      </div>

      {/* ── SECONDARY ACTIONS ── */}
      <div className="grid grid-cols-2 gap-3 px-4 mt-3">
        <button
          onClick={() => navigate('/market')}
          className="flex items-center gap-3 bg-white border-2 active:scale-95 px-3 rounded-2xl transition-all"
          style={{ minHeight: '64px', borderColor: '#F1F5F9' }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#F0FDFA' }}>
            <Store size={19} style={{ color: '#008055' }} />
          </div>
          <div className="text-left min-w-0">
            <p className="text-sm font-black text-slate-900 leading-tight truncate" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              {t.vendors}
            </p>
            <p className="text-xs text-slate-500 mt-0.5 truncate">{t.vendorsSub}</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/customer/history')}
          className="flex items-center gap-3 bg-white border-2 active:scale-95 px-3 rounded-2xl transition-all"
          style={{ minHeight: '64px', borderColor: '#F1F5F9' }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#FEF3C7' }}>
            <ShoppingBag size={19} style={{ color: '#D97706' }} />
          </div>
          <div className="text-left min-w-0">
            <p className="text-sm font-black text-slate-900 leading-tight truncate" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              {t.history}
            </p>
            <p className="text-xs text-slate-500 mt-0.5 truncate">{t.historySub}</p>
          </div>
        </button>
      </div>

      {/* ── RECENT PAYMENTS ── */}
      <div className="mx-4 mt-4 bg-white rounded-3xl overflow-hidden" style={{ border: '1.5px solid #F1F5F9' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1.5px solid #F8FAFC' }}>
          <h2
            className="text-base font-black text-slate-900"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            {t.recentPayments}
          </h2>
          <button
            onClick={() => navigate('/customer/history')}
            className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full active:scale-95"
            style={{ color: '#008055', backgroundColor: '#F0FDFA' }}
          >
            {t.viewAll} <ArrowRight size={11} />
          </button>
        </div>

        <div className="px-3 py-3">
          {isLoading && (
            <div className="space-y-3 p-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl skeleton shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-32 skeleton rounded-lg" />
                    <div className="h-2.5 w-20 skeleton rounded-lg" />
                  </div>
                  <div className="h-5 w-16 skeleton rounded-lg" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && recent.length === 0 && (
            <div className="text-center py-12 px-4">
              <div
                className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: '#F0FDFA', border: '2px solid #CCFBF1' }}
              >
                <ShoppingBag size={26} style={{ color: '#14B8A6' }} />
              </div>
              <p className="text-base font-black text-slate-700 mb-1" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                {t.emptyTitle}
              </p>
              <p className="text-sm text-slate-500 mb-5">{t.emptyDesc}</p>
              <button
                onClick={() => navigate('/customer/scan')}
                className="inline-flex items-center gap-2 text-sm font-bold px-5 py-3 rounded-2xl active:scale-95"
                style={{ color: 'white', backgroundColor: '#008055' }}
              >
                <ScanLine size={15} /> {t.scanNow}
              </button>
            </div>
          )}

          {!isLoading && groups.length > 0 && (
            <div className="space-y-4">
              {groups.map(({ label, txs }) => (
                <div key={label}>
                  <div className="flex items-center gap-2 mb-1 px-2">
                    <span className="flex-1 h-px" style={{ backgroundColor: '#F1F5F9' }} />
                    <span
                      className="text-xs font-bold uppercase tracking-widest px-2"
                      style={{ color: '#94A3B8' }}
                    >
                      {label}
                    </span>
                    <span className="flex-1 h-px" style={{ backgroundColor: '#F1F5F9' }} />
                  </div>
                  <div>
                    {txs.map(tx => <RecentTxRow key={tx.id} tx={tx} />)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
