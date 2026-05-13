import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CalendarDays, Database, Download, ExternalLink, FileJson, Printer, QrCode, RefreshCw, ShieldCheck, TrendingUp, Zap } from 'lucide-react';
import { useWallet } from '../../lib/hooks/useWallet';
import { useVendor } from '../../lib/hooks/useVendor';
import { useVendorTransactions, relativeTime } from '../../lib/hooks/useTransactions';
import type { TxRecord } from '../../lib/hooks/useTransactions';
import { truncateAddress, stellarExpertUrl } from '../../lib/stellar';
import { WalletRequiredState } from '../../components/WalletRequiredState';
import {
  buildProofBundle,
  buildProofSummary,
  filterTransactionsByPeriod,
  PROOF_PERIODS,
  toProofCsv,
  type ProofPeriodKind,
} from '../../lib/vendor-proof';

const STRINGS = {
  en: {
    header: 'All Earnings',
    allTimeSub: 'XLM all-time',
    todayEarnings: "Today's Earnings",
    paymentsToday: 'Payments Today',
    emptyTitle: 'No transactions yet',
    emptyDesc: 'Share your QR code to receive your first payment',
    showQr: 'Show QR',
    failedTitle: 'Failed to load',
    retry: 'Retry',
    today: 'Today',
    yesterday: 'Yesterday',
  },
  tl: {
    header: 'Lahat ng Kita',
    allTimeSub: 'XLM kabuuan',
    todayEarnings: 'Kita Ngayon',
    paymentsToday: 'Mga Bayad Ngayon',
    emptyTitle: 'Wala pang bayad',
    emptyDesc: 'I-share ang QR code para matanggap ang unang bayad',
    showQr: 'Ipakita ang QR',
    failedTitle: 'Hindi ma-load',
    retry: 'Subukan Ulit',
    today: 'Ngayon',
    yesterday: 'Kahapon',
  },
};

function groupByDate(txs: TxRecord[], t: typeof STRINGS['en']) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const buckets: Record<string, TxRecord[]> = {};
  for (const tx of txs) {
    const d = new Date(tx.createdAt); d.setHours(0, 0, 0, 0);
    const key = d.getTime() === today.getTime() ? t.today
      : d.getTime() === yesterday.getTime() ? t.yesterday
      : d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(tx);
  }
  return Object.entries(buckets).map(([label, txs]) => ({ label, txs }));
}

const PALETTE: Array<[string, string]> = [
  ['#FEE2E2', '#EF4444'], ['#FEF3C7', '#D97706'], ['#D1FAE5', '#059669'],
  ['#DBEAFE', '#3B82F6'], ['#EDE9FE', '#042E80'], ['#FCE7F3', '#DB2777'],
  ['#CCFBF1', '#008055'], ['#FED7AA', '#EA580C'],
];
function hashColor(s: string): [string, string] {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff;
  return PALETTE[h % PALETTE.length];
}

function TxRow({ tx }: { tx: TxRecord }) {
  const display = truncateAddress(tx.from);
  const [bgColor, textColor] = hashColor(tx.from);
  const initial = tx.from[1]?.toUpperCase() ?? 'G';

  return (
    <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black shrink-0"
          style={{ backgroundColor: bgColor, color: textColor }}
        >
          {initial}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-mono font-bold text-slate-700 truncate">{display}</p>
          {tx.memo && (
            <p className="text-xs font-medium truncate mt-0.5" style={{ color: '#008055' }}>{tx.memo}</p>
          )}
          <p className="text-xs text-slate-400">{relativeTime(tx.createdAt)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-3">
        <div className="text-right">
          <p className="text-sm font-black" style={{ color: '#16A34A' }}>
            +{tx.amountXlm.toFixed(2)}
          </p>
          <p className="text-xs text-slate-400">XLM</p>
        </div>
        {tx.txHash && (
          <a
            href={stellarExpertUrl(tx.txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="w-7 h-7 rounded-lg flex items-center justify-center active:scale-95"
            style={{ backgroundColor: '#F8FAFC' }}
          >
            <ExternalLink size={12} style={{ color: '#94A3B8' }} />
          </a>
        )}
      </div>
    </div>
  );
}

export function VendorTransactions() {
  const navigate = useNavigate();
  const { address } = useWallet();
  const { vendor } = useVendor(address);
  const { transactions, isLoading, error, retry, todayEarnings, todayCount } = useVendorTransactions(address);
  const [lang, setLang] = useState<'en' | 'tl'>('tl');
  const [periodKind, setPeriodKind] = useState<ProofPeriodKind>('30d');
  const t = STRINGS[lang];
  const selectedPeriod = PROOF_PERIODS.find((period) => period.kind === periodKind) ?? PROOF_PERIODS[1];
  const proofTransactions = useMemo(
    () => filterTransactionsByPeriod(transactions, selectedPeriod),
    [transactions, selectedPeriod],
  );
  const proofSummary = useMemo(() => buildProofSummary({
    vendor: {
      name: vendor?.name ?? 'Vendor',
      wallet: address ?? '',
      stallNumber: vendor?.stallNumber,
      productType: vendor?.productType,
    },
    transactions: proofTransactions,
    period: selectedPeriod,
    hasLivePaymentProof: false,
  }), [address, proofTransactions, selectedPeriod, vendor]);

  const earnings = todayEarnings();
  const count = todayCount();
  const allTimeTotal = transactions.reduce((s, tx) => s + tx.amountXlm, 0);
  const groups = groupByDate(transactions, t);

  if (!address) {
    return <WalletRequiredState detail="Connect your vendor wallet to load earnings history and receipt links." />;
  }

  function downloadProof(type: 'csv' | 'json') {
    const text = type === 'csv'
      ? toProofCsv(proofSummary)
      : JSON.stringify(buildProofBundle(proofSummary), null, 2);
    const mime = type === 'csv' ? 'text/csv' : 'application/json';
    const blob = new Blob([text], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `palengkepay-proof-${selectedPeriod.kind}-${new Date().toISOString().slice(0, 10)}.${type}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4 animate-page-in">

      {/* ── Hero stats card ── */}
      <div className="relative rounded-3xl overflow-hidden" style={{ backgroundColor: '#00284B' }}>
        {/* Banig texture */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage: `repeating-linear-gradient(
              45deg, white 0px, white 1px, transparent 1px, transparent 12px
            ), repeating-linear-gradient(
              -45deg, white 0px, white 1px, transparent 1px, transparent 12px
            )`,
          }}
        />
        {/* Ambient glow */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: -60, right: -40, width: 240, height: 240, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(20,184,166,0.3) 0%, transparent 65%)',
            filter: 'blur(50px)',
          }}
        />
        {/* ₱ watermark */}
        <div
          className="absolute select-none pointer-events-none font-black"
          style={{
            fontSize: '9rem', lineHeight: 1, color: 'rgba(255,255,255,0.03)',
            bottom: -10, right: 8, fontFamily: "'Montserrat', sans-serif",
          }}
        >₱</div>

        <div className="relative p-5">
          {/* Label + lang toggle */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {t.header}
            </p>
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

          {isLoading ? (
            <div className="space-y-2">
              <div className="h-9 w-36 skeleton rounded-xl" />
              <div className="h-3 w-24 skeleton rounded" />
            </div>
          ) : (
            <>
              <p
                className="font-black text-white leading-none mb-1"
                style={{
                  fontSize: allTimeTotal.toFixed(2).length > 8 ? '2rem' : '2.5rem',
                  fontFamily: "'Montserrat', sans-serif",
                  letterSpacing: '-0.02em',
                }}
              >
                {allTimeTotal.toFixed(2)}
              </p>
              <p className="text-sm font-semibold mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {t.allTimeSub}
              </p>

              <div className="grid grid-cols-2 gap-2 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <div>
                  <p className="text-xs font-medium mb-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {t.todayEarnings}
                  </p>
                  <p className="text-base font-black text-white flex items-center gap-1" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                    <Zap size={13} style={{ color: '#FDE68A' }} />
                    {earnings.toFixed(2)}
                    <span className="text-xs font-normal" style={{ color: 'rgba(255,255,255,0.4)' }}>XLM</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium mb-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {t.paymentsToday}
                  </p>
                  <p className="text-base font-black text-white" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                    {count}
                    <span className="text-xs font-normal ml-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      payment{count !== 1 ? 's' : ''}
                    </span>
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Proof workspace ── */}
      <section
        className="rounded-3xl overflow-hidden bg-white"
        style={{ border: '1.5px solid #E2E8F0', boxShadow: '0 10px 28px rgba(15,23,42,0.05)' }}
      >
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck size={18} style={{ color: '#008055' }} />
                <h2 className="text-base font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                  Income Proof Pack
                </h2>
              </div>
              <p className="text-xs text-slate-500">
                Exportable vendor proof with source labels and Testnet caveats.
              </p>
            </div>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black shrink-0"
              style={{
                backgroundColor: proofSummary.hasFallbackCaveat ? '#FFFBEB' : '#ECFDF5',
                color: proofSummary.hasFallbackCaveat ? '#B45309' : '#047857',
                border: `1px solid ${proofSummary.hasFallbackCaveat ? '#FDE68A' : '#A7F3D0'}`,
              }}
            >
              <Database size={12} />
              {proofSummary.sourceLabel}
            </span>
          </div>

          <div className="flex gap-1 p-1 rounded-2xl" style={{ backgroundColor: '#F1F5F9' }}>
            {PROOF_PERIODS.map((period) => (
              <button
                key={period.kind}
                onClick={() => setPeriodKind(period.kind)}
                className="flex-1 text-xs font-black rounded-xl transition-all"
                style={{
                  minHeight: 38,
                  backgroundColor: periodKind === period.kind ? 'white' : 'transparent',
                  color: periodKind === period.kind ? '#008055' : '#64748B',
                  boxShadow: periodKind === period.kind ? '0 1px 6px rgba(15,23,42,0.1)' : 'none',
                }}
              >
                {period.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Transactions', value: String(proofSummary.transactionCount) },
              { label: 'Total XLM', value: proofSummary.totalXlm.toFixed(2) },
              { label: 'Avg XLM', value: proofSummary.averageXlm.toFixed(2) },
              { label: 'Customers', value: String(proofSummary.uniqueCustomers) },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-2xl p-3" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <p className="text-xs font-bold text-slate-400 mb-1">{label}</p>
                <p className="text-lg font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl p-4" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <div className="flex items-center gap-2 mb-2">
              <CalendarDays size={15} style={{ color: '#008055' }} />
              <p className="text-sm font-black text-slate-800">{proofSummary.readiness.label}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <p className="text-slate-500">Payment data: <span className="font-bold text-slate-700">{proofSummary.readiness.paymentDataPresent ? 'Present' : 'Missing'}</span></p>
              <p className="text-slate-500">Repayment data: <span className="font-bold text-slate-700">{proofSummary.readiness.repaymentDataPresent ? 'Present' : 'Not attached'}</span></p>
              <p className="text-slate-500">Live proof: <span className="font-bold text-slate-700">{proofSummary.readiness.liveProofMissing ? 'Missing' : 'Attached'}</span></p>
              <p className="text-slate-500">PHP total: <span className="font-bold text-slate-700">Unavailable</span></p>
            </div>
          </div>

          <div className="rounded-2xl p-4" style={{ backgroundColor: '#FFF7ED', border: '1px solid #FED7AA' }}>
            <p className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: '#C2410C' }}>Caveats</p>
            <ul className="space-y-1">
              {proofSummary.caveats.map((caveat) => (
                <li key={caveat} className="text-xs text-orange-800">- {caveat}</li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => downloadProof('csv')}
              disabled={proofSummary.transactionCount === 0}
              className="flex items-center justify-center gap-1.5 text-xs font-black rounded-2xl active:scale-95 disabled:opacity-50"
              style={{ minHeight: 46, color: 'white', backgroundColor: '#008055' }}
            >
              <Download size={14} /> CSV
            </button>
            <button
              onClick={() => downloadProof('json')}
              disabled={proofSummary.transactionCount === 0}
              className="flex items-center justify-center gap-1.5 text-xs font-black rounded-2xl active:scale-95 disabled:opacity-50"
              style={{ minHeight: 46, color: '#008055', backgroundColor: '#F0FDFA', border: '1px solid #CCFBF1' }}
            >
              <FileJson size={14} /> JSON
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center justify-center gap-1.5 text-xs font-black rounded-2xl active:scale-95"
              style={{ minHeight: 46, color: '#334155', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}
            >
              <Printer size={14} /> Print
            </button>
          </div>
        </div>
      </section>

      {/* ── Transactions list ── */}
      <div className="rounded-3xl overflow-hidden" style={{ border: '1.5px solid #F1F5F9' }}>

        {isLoading && (
          <div className="bg-white p-5 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl skeleton shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-28 skeleton rounded" />
                  <div className="h-3 w-20 skeleton rounded" />
                </div>
                <div className="space-y-1 items-end flex flex-col">
                  <div className="h-3.5 w-14 skeleton rounded" />
                  <div className="h-3 w-8 skeleton rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && error && (
          <div className="bg-white p-10 text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: '#FFF1F2', border: '1.5px solid #FECDD3' }}
            >
              <AlertCircle size={24} style={{ color: '#F43F5E' }} />
            </div>
            <p className="text-sm font-bold text-slate-700 mb-1" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              {t.failedTitle}
            </p>
            <p className="text-xs text-slate-400 mb-5">{error}</p>
            <button
              onClick={retry}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-5 py-2.5 rounded-xl active:scale-95 text-white"
              style={{ backgroundColor: '#008055' }}
            >
              <RefreshCw size={12} /> {t.retry}
            </button>
          </div>
        )}

        {!isLoading && !error && transactions.length === 0 && (
          <div className="bg-white p-10 text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: '#F0FDFA', border: '1.5px solid #CCFBF1' }}
            >
              <TrendingUp size={28} style={{ color: '#008055' }} />
            </div>
            <p className="text-sm font-bold text-slate-700 mb-1" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              {t.emptyTitle}
            </p>
            <p className="text-xs text-slate-400 mb-5">{t.emptyDesc}</p>
            <button
              onClick={() => navigate('/vendor/qr')}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-5 py-2.5 rounded-xl active:scale-95 text-white"
              style={{ backgroundColor: '#008055' }}
            >
              <QrCode size={12} /> {t.showQr}
            </button>
          </div>
        )}

        {!isLoading && !error && groups.length > 0 && (
          <div className="bg-white p-5 space-y-5">
            {groups.map(({ label, txs }) => (
              <div key={label}>
                <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: '#94A3B8' }}>
                  {label}
                </p>
                <div className="divide-y divide-slate-50">
                  {txs.map((tx) => <TxRow key={tx.id} tx={tx} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
