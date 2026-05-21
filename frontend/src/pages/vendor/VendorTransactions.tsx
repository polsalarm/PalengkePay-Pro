



import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CalendarDays, CheckCircle2, Copy, Database, Download, ExternalLink, FileJson, FileText, Printer, QrCode, RefreshCw, Search, ShieldCheck, TrendingUp, Zap } from 'lucide-react';
import { useWallet } from '../../lib/hooks/useWallet';
import { useVendor } from '../../lib/hooks/useVendor';
import { useVendorTransactions, relativeTime } from '../../lib/hooks/useTransactions';
import type { TxRecord } from '../../lib/hooks/useTransactions';
import { truncateAddress } from '../../lib/stellar';
import { WalletRequiredState } from '../../components/WalletRequiredState';
import { formatPhp } from '../../lib/checkout-quote';
import {
  buildVendorRecoverySummary,
  getTransactionReceiptReference,
  lookupTransactionReceipt,
} from '../../lib/vendor-transaction-recovery';
import {
  buildIncomeProofCertificate,
  buildProofBundle,
  buildProofSummary,
  filterTransactionsBySearch,
  filterTransactionsByPeriod,
  PROOF_PERIODS,
  toCertificateText,
  toProofCsv,
  type ProofPeriodKind,
} from '../../lib/vendor-proof';
import { useLanguage } from '../../contexts/LanguageContext';

function groupByDate(txs: TxRecord[], t: (key: string, params?: any) => string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const buckets: Record<string, TxRecord[]> = {};
  for (const tx of txs) {
    const d = new Date(tx.createdAt); d.setHours(0, 0, 0, 0);
    const key = d.getTime() === today.getTime() ? t('common.today')
      : d.getTime() === yesterday.getTime() ? t('common.yesterday')
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
  const receipt = getTransactionReceiptReference(tx);

  return (
    <div className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
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
          {tx.quote && (
            <p className="text-xs font-black truncate mt-0.5" style={{ color: '#0F766E' }}>
              {formatPhp(tx.quote.phpAmount)} · ₱{tx.quote.phpPerXlm.toFixed(2)}/XLM
            </p>
          )}
          <p className="text-xs text-slate-400">{relativeTime(tx.createdAt)}</p>
          <p className="text-[11px] font-bold text-slate-400 mt-1 truncate">
            {receipt.label}: {receipt.value}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-3">
        <div className="text-right">
          <p className="text-sm font-black" style={{ color: '#16A34A' }}>
            +{tx.amountXlm.toFixed(2)}
          </p>
          <p className="text-xs text-slate-400">XLM</p>
        </div>
        {receipt.lookupUrl && (
          <a
            href={receipt.lookupUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-11 h-11 rounded-xl flex items-center justify-center active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            aria-label={`Open receipt ${receipt.value}`}
            style={{ backgroundColor: '#F8FAFC' }}
          >
            <ExternalLink size={12} aria-hidden="true" style={{ color: '#94A3B8' }} />
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
  const { t } = useLanguage();
  const [periodKind, setPeriodKind] = useState<ProofPeriodKind>('30d');
  const [searchTerm, setSearchTerm] = useState('');
  const [receiptLookupTerm, setReceiptLookupTerm] = useState('');
  const [exportStatus, setExportStatus] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const selectedPeriod = PROOF_PERIODS.find((period) => period.kind === periodKind) ?? PROOF_PERIODS[1];
  const searchedTransactions = useMemo(
    () => filterTransactionsBySearch(transactions, searchTerm),
    [transactions, searchTerm],
  );
  const proofTransactions = useMemo(
    () => filterTransactionsBySearch(filterTransactionsByPeriod(transactions, selectedPeriod), searchTerm),
    [transactions, selectedPeriod, searchTerm],
  );
  const proofSummary = useMemo(() => buildProofSummary({
    livePaymentTxHash: proofTransactions.find((payment) => payment.txHash)?.txHash,
    vendor: {
      name: vendor?.name ?? 'Vendor',
      wallet: address ?? '',
      stallNumber: vendor?.stallNumber,
      productType: vendor?.productType,
    },
    transactions: proofTransactions,
    period: selectedPeriod,
    hasLivePaymentProof: proofTransactions.some((payment) => !!payment.txHash),
  }), [address, proofTransactions, selectedPeriod, vendor]);
  const recoverySummary = useMemo(
    () => buildVendorRecoverySummary(searchedTransactions, error),
    [searchedTransactions, error],
  );
  const certificate = useMemo(
    () => buildIncomeProofCertificate(proofSummary),
    [proofSummary],
  );
  const receiptLookup = useMemo(
    () => lookupTransactionReceipt(transactions, receiptLookupTerm),
    [transactions, receiptLookupTerm],
  );

  const earnings = todayEarnings();
  const count = todayCount();
  const allTimeTotal = transactions.reduce((s, tx) => s + tx.amountXlm, 0);
  const groups = groupByDate(searchedTransactions, t);
  const proofActionStatus = copyStatus || exportStatus;

  if (!address) {
    return <WalletRequiredState detail="Connect your vendor wallet to load earnings history and receipt links." />;
  }

  function downloadProof(type: 'csv' | 'json' | 'certificate') {
    const text = type === 'csv'
      ? toProofCsv(proofSummary)
      : type === 'json'
        ? JSON.stringify(buildProofBundle(proofSummary), null, 2)
        : toCertificateText(proofSummary);
    const mime = type === 'csv' ? 'text/csv' : type === 'json' ? 'application/json' : 'text/plain';
    const extension = type === 'certificate' ? 'txt' : type;
    const blob = new Blob([text], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `palengkepay-proof-${selectedPeriod.kind}-${new Date().toISOString().slice(0, 10)}.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setCopyStatus('');
    setExportStatus(`${type === 'certificate' ? 'Certificate' : type.toUpperCase()} export prepared for ${proofSummary.transactionCount} transaction${proofSummary.transactionCount === 1 ? '' : 's'}.`);
  }

  async function copyToClipboard(value: string, label: string) {
    setExportStatus('');
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus(`${label} copied.`);
    } catch {
      setCopyStatus(`${label} ready to copy: ${value}`);
    }
  }

  return (
    <div className="space-y-4 animate-page-in">

      {/* ── Hero stats card ── */}
      <div className="relative rounded-3xl overflow-hidden" style={{ backgroundColor: '#00284B' }}>
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
        <div
          className="absolute select-none pointer-events-none font-black"
          style={{
            fontSize: '9rem', lineHeight: 1, color: 'rgba(255,255,255,0.03)',
            bottom: -10, right: 8, fontFamily: "'Montserrat', sans-serif",
          }}
        >₱</div>

        <div className="relative p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {t('transactions.header')}
            </p>
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
                  letterSpacing: 0,
                }}
              >
                {allTimeTotal.toFixed(2)}
              </p>
              <p className="text-sm font-semibold mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {t('transactions.allTimeSub')}
              </p>

              <div className="grid grid-cols-2 gap-2 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <div>
                  <p className="text-xs font-medium mb-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {t('transactions.todayEarnings')}
                  </p>
                  <p className="text-base font-black text-white flex items-center gap-1" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                    <Zap size={13} style={{ color: '#FDE68A' }} />
                    {earnings.toFixed(2)}
                    <span className="text-xs font-normal" style={{ color: 'rgba(255,255,255,0.4)' }}>XLM</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium mb-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {t('transactions.paymentsToday')}
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck size={18} aria-hidden="true" style={{ color: '#008055' }} />
                <h2 className="text-base font-black text-slate-900">
                  {t('transactions.incomeProofPack')}
                </h2>
              </div>
              <p className="text-xs text-slate-500">
                {t('transactions.incomeProofDesc')}
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
              <Database size={12} aria-hidden="true" />
              {proofSummary.sourceLabel}
            </span>
          </div>

          <div className="flex gap-1 p-1 rounded-2xl" style={{ backgroundColor: '#F1F5F9' }}>
            {PROOF_PERIODS.map((period) => (
              <button
                key={period.kind}
                type="button"
                aria-pressed={periodKind === period.kind}
                onClick={() => setPeriodKind(period.kind)}
                className="flex-1 text-xs font-black rounded-xl transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{
                  minHeight: 44,
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
              { label: t('transactions.transactions'), value: String(proofSummary.transactionCount) },
              { label: t('transactions.totalXlm'), value: proofSummary.totalXlm.toFixed(2) },
              { label: t('transactions.phpEst'), value: proofSummary.estimatedPhpTotal ? `PHP ${proofSummary.estimatedPhpTotal.toFixed(2)}` : t('transactions.unavailable') },
              { label: t('transactions.dateRange'), value: proofSummary.dateRange.label },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-2xl p-3" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <p className="text-xs font-bold text-slate-400 mb-1">{label}</p>
                <p
                  className="text-base font-black text-slate-900 break-words"
                  style={{ fontFamily: "'Montserrat', sans-serif" }}
                >
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl p-4" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <div className="flex items-center gap-2 mb-2">
              <CalendarDays size={15} aria-hidden="true" style={{ color: '#008055' }} />
              <p className="text-sm font-black text-slate-800">{proofSummary.readiness.label}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <p className="text-slate-500">{t('transactions.paymentData')}: <span className="font-bold text-slate-700">{proofSummary.readiness.paymentDataPresent ? t('transactions.present') : t('transactions.missing')}</span></p>
              <p className="text-slate-500">{t('transactions.repaymentData')}: <span className="font-bold text-slate-700">{proofSummary.readiness.repaymentDataPresent ? t('transactions.present') : t('transactions.notAttached')}</span></p>
              <p className="text-slate-500">{t('transactions.liveProof')}: <span className="font-bold text-slate-700">{proofSummary.readiness.liveProofMissing ? t('transactions.missing') : t('transactions.attached')}</span></p>
              <p className="text-slate-500">{t('transactions.customers')}: <span className="font-bold text-slate-700">{proofSummary.uniqueCustomers}</span></p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3" aria-label="Proof readiness checklist">
            {[
              {
                label: t('transactions.paymentRows'),
                value: proofSummary.readiness.paymentDataPresent ? `${proofSummary.transactionCount} ${t('transactions.attached')}` : t('transactions.missing'),
                ok: proofSummary.readiness.paymentDataPresent,
              },
              {
                label: t('transactions.liveHash'),
                value: proofSummary.livePaymentTxHash ? t('transactions.attached') : t('transactions.needed'),
                ok: !!proofSummary.livePaymentTxHash,
              },
              {
                label: t('transactions.repayments'),
                value: proofSummary.readiness.repaymentDataPresent ? t('transactions.attached') : t('transactions.notAttached'),
                ok: proofSummary.readiness.repaymentDataPresent,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="flex min-h-14 items-center gap-3 rounded-2xl px-3"
                style={{
                  backgroundColor: item.ok ? '#F0FDFA' : '#FFF7ED',
                  border: `1px solid ${item.ok ? '#A7F3D0' : '#FED7AA'}`,
                }}
              >
                {item.ok ? (
                  <CheckCircle2 size={16} aria-hidden="true" style={{ color: '#047857' }} />
                ) : (
                  <AlertCircle size={16} aria-hidden="true" style={{ color: '#C2410C' }} />
                )}
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">{item.label}</p>
                  <p className="text-xs font-black text-slate-900">{item.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl p-4" style={{ backgroundColor: '#FFF7ED', border: '1px solid #FED7AA' }}>
            <p className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: '#C2410C' }}>
              {t('transactions.caveats')}
            </p>
            <ul className="space-y-1">
              {proofSummary.caveats.map((caveat) => (
                <li key={caveat} className="text-xs text-orange-800">- {caveat}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl p-4" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#ECFDF5' }}>
                <FileText size={18} aria-hidden="true" style={{ color: '#008055' }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                  {certificate.title}
                </p>
                <p className="text-xs text-slate-500 mt-1">{certificate.audience}</p>
                <p className="text-sm font-black text-slate-800 mt-3 break-words">{certificate.vendorLine}</p>
                <p className="text-xs text-slate-500 mt-1">{certificate.generatedLine}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {certificate.highlights.map((item) => (
                <div key={item.label} className="rounded-xl p-3 bg-white" style={{ border: '1px solid #E2E8F0' }}>
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{item.label}</p>
                  <p className="text-sm font-black text-slate-900 mt-1 break-words">{item.value}</p>
                </div>
              ))}
            </div>
            <p className="text-xs font-semibold mt-3" style={{ color: proofSummary.readiness.liveProofMissing ? '#C2410C' : '#047857' }}>
              {certificate.attestation}
            </p>
            {proofSummary.livePaymentTxHash ? (
              <button
                type="button"
                onClick={() => void copyToClipboard(proofSummary.livePaymentTxHash ?? '', t('transactions.liveHash'))}
                className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-xs font-black active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ color: '#008055', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0' }}
              >
                <Copy size={13} aria-hidden="true" /> {t('transactions.copyLiveHash')}
              </button>
            ) : (
              <p className="mt-3 rounded-xl px-3 py-2 text-xs font-semibold" style={{ color: '#9A3412', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
                {t('transactions.captureHashHint')}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => downloadProof('csv')}
              disabled={proofSummary.transactionCount === 0}
              className="flex items-center justify-center gap-1.5 text-xs font-black rounded-2xl active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ minHeight: 46, color: 'white', backgroundColor: '#008055' }}
            >
              <Download size={14} aria-hidden="true" /> CSV
            </button>
            <button
              type="button"
              onClick={() => downloadProof('json')}
              disabled={proofSummary.transactionCount === 0}
              className="flex items-center justify-center gap-1.5 text-xs font-black rounded-2xl active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ minHeight: 46, color: '#008055', backgroundColor: '#F0FDFA', border: '1px solid #CCFBF1' }}
            >
              <FileJson size={14} aria-hidden="true" /> JSON
            </button>
            <button
              type="button"
              onClick={() => downloadProof('certificate')}
              disabled={proofSummary.transactionCount === 0}
              className="flex items-center justify-center gap-1.5 text-xs font-black rounded-2xl active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ minHeight: 46, color: '#0F172A', backgroundColor: '#EEF2FF', border: '1px solid #C7D2FE' }}
            >
              <FileText size={14} aria-hidden="true" /> {t('transactions.certificate')}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center justify-center gap-1.5 text-xs font-black rounded-2xl active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ minHeight: 46, color: '#334155', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}
            >
              <Printer size={14} aria-hidden="true" /> {t('transactions.print')}
            </button>
          </div>
          {proofActionStatus && (
            <p
              role="status"
              aria-label="Export status"
              aria-live="polite"
              className="flex min-h-11 items-center gap-2 rounded-2xl px-3 text-xs font-black"
              style={{ color: '#047857', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0' }}
            >
              <CheckCircle2 size={15} aria-hidden="true" />
              {proofActionStatus}
            </p>
          )}
        </div>
      </section>

      {/* ── Recovery workspace ── */}
      <section
        className="rounded-3xl overflow-hidden bg-white"
        style={{ border: '1.5px solid #E2E8F0', boxShadow: '0 10px 28px rgba(15,23,42,0.05)' }}
      >
        <div className="p-5 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <RefreshCw size={18} aria-hidden="true" style={{ color: '#008055' }} />
                <h2 className="text-base font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                  {t('transactions.recoveryDesk')}
                </h2>
              </div>
              <p className="text-xs text-slate-500">
                {t('transactions.recoveryDesc')}
              </p>
            </div>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black shrink-0"
              style={{ backgroundColor: '#F0FDFA', color: '#047857', border: '1px solid #A7F3D0' }}
            >
              {recoverySummary.receiptLookup.availableCount} refs
            </span>
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <div className="rounded-2xl p-4" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                {t('transactions.receiptLookup')}
              </p>
              <p className="text-sm font-black text-slate-900 break-words" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                {recoverySummary.receiptLookup.latestReference ?? t('transactions.noReceiptYet')}
              </p>
              <p className="text-xs text-slate-500 mt-2">{recoverySummary.receiptLookup.detail}</p>
              {recoverySummary.receiptLookup.latestUrl && (
                <a
                  href={recoverySummary.receiptLookup.latestUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1.5 text-xs font-black mt-3 rounded-xl px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{ color: '#008055', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0' }}
                >
                  <ExternalLink size={12} aria-hidden="true" /> {t('transactions.checkReceipt')}
                </a>
              )}
            </div>

            <div className="rounded-2xl p-4" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                {t('transactions.resendPath')}
              </p>
              <p className="text-sm font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                {recoverySummary.resend.title}
              </p>
              <p className="text-xs text-slate-500 mt-2">{recoverySummary.resend.detail}</p>
              <button
                type="button"
                onClick={() => navigate(recoverySummary.resend.actionPath)}
                className="inline-flex min-h-11 items-center gap-1.5 text-xs font-black mt-3 rounded-xl px-3 active:scale-95 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ backgroundColor: '#008055' }}
              >
                <QrCode size={12} aria-hidden="true" /> {recoverySummary.resend.actionLabel}
              </button>
            </div>

            <div className="rounded-2xl p-4" style={{ backgroundColor: '#FFF7ED', border: '1px solid #FED7AA' }}>
              <p className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: '#C2410C' }}>
                {t('transactions.sponsorDiagnostics')}
              </p>
              <p className="text-sm font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                {recoverySummary.feeBumpDiagnostic.title}
              </p>
              <p className="text-xs text-orange-800 mt-2">{recoverySummary.feeBumpDiagnostic.detail}</p>
              <p className="inline-flex min-h-11 items-center gap-1.5 text-xs font-black mt-3 rounded-xl px-3" style={{ color: '#C2410C', backgroundColor: '#FFEDD5' }}>
                <AlertCircle size={12} aria-hidden="true" /> {recoverySummary.feeBumpDiagnostic.actionLabel}
              </p>
            </div>
          </div>

          <div className="rounded-2xl p-4" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <label htmlFor="receipt-reference-lookup" className="text-xs font-black uppercase tracking-widest text-slate-400">
              {t('transactions.lookupByHash')}
            </label>
            <p id="receipt-reference-help" className="mt-1 text-xs text-slate-500">
              {t('transactions.lookupHelp')}
            </p>
            <div className="mt-2 flex items-center gap-2 rounded-2xl px-3 bg-white" style={{ minHeight: 48, border: '1px solid #E2E8F0' }}>
              <Search size={16} aria-hidden="true" style={{ color: '#64748B' }} />
              <input
                id="receipt-reference-lookup"
                type="search"
                value={receiptLookupTerm}
                onChange={(event) => setReceiptLookupTerm(event.target.value)}
                placeholder={t('transactions.lookupPlaceholder')}
                aria-describedby="receipt-reference-help receipt-reference-result"
                autoComplete="off"
                enterKeyHint="search"
                spellCheck={false}
                className="w-full bg-transparent text-base sm:text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400"
              />
              {recoverySummary.receiptLookup.latestReference && !receiptLookupTerm && (
                <button
                  type="button"
                  onClick={() => setReceiptLookupTerm(recoverySummary.receiptLookup.latestReference ?? '')}
                  className="min-h-11 rounded-xl px-3 text-xs font-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{ color: '#008055', backgroundColor: '#ECFDF5' }}
                >
                  {t('transactions.useLatest')}
                </button>
              )}
              {receiptLookupTerm && (
                <button
                  type="button"
                  aria-label={t('transactions.clear')}
                  onClick={() => setReceiptLookupTerm('')}
                  className="min-h-11 rounded-xl px-3 text-xs font-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{ color: '#475569', backgroundColor: '#F8FAFC' }}
                >
                  {t('transactions.clear')}
                  <span className="sr-only"> receipt lookup</span>
                </button>
              )}
            </div>
            <div
              id="receipt-reference-result"
              role="status"
              aria-live="polite"
              className="mt-3 rounded-xl p-3 bg-white"
              style={{ border: '1px solid #E2E8F0' }}
            >
              <p className="text-xs font-black text-slate-700">
                {receiptLookup.status === 'found' ? `${receiptLookup.reference?.label}: ${receiptLookup.reference?.value}` : t('transactions.receiptLookup')}
              </p>
              <p className="text-xs text-slate-500 mt-1">{receiptLookup.message}</p>
              {receiptLookup.reference?.lookupUrl && (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <a
                    href={receiptLookup.reference.lookupUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-1.5 text-xs font-black rounded-xl px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{ color: '#008055', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0' }}
                  >
                    <ExternalLink size={12} aria-hidden="true" /> {t('transactions.openMatchedReceipt')}
                  </a>
                  <button
                    type="button"
                    onClick={() => void copyToClipboard(receiptLookup.reference?.value ?? '', t('transactions.receiptReference'))}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-xs font-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{ color: '#334155', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}
                  >
                    <Copy size={12} aria-hidden="true" /> {t('transactions.copyReference')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section
        className="rounded-3xl bg-white p-4"
        style={{ border: '1.5px solid #E2E8F0', boxShadow: '0 10px 28px rgba(15,23,42,0.04)' }}
      >
        <label htmlFor="vendor-transaction-search" className="text-xs font-black uppercase tracking-widest text-slate-400">
          {t('transactions.searchReceipts')}
        </label>
        <div className="mt-2 flex items-center gap-2 rounded-2xl px-3" style={{ minHeight: 48, backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          <Search size={16} aria-hidden="true" style={{ color: '#64748B' }} />
          <input
            id="vendor-transaction-search"
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={t('transactions.searchPlaceholder')}
            autoComplete="off"
            enterKeyHint="search"
            spellCheck={false}
            className="w-full bg-transparent text-base sm:text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400"
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {t('transactions.searchResultInfo', { shown: searchedTransactions.length, total: transactions.length })}
        </p>
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
              <AlertCircle size={24} aria-hidden="true" style={{ color: '#F43F5E' }} />
            </div>
            <p className="text-sm font-bold text-slate-700 mb-1" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              {t('transactions.failedTitle')}
            </p>
            <p className="text-xs text-slate-400 mb-5">{error}</p>
            <button
              type="button"
              onClick={retry}
              className="inline-flex min-h-11 items-center gap-1.5 text-xs font-bold px-5 rounded-xl active:scale-95 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ backgroundColor: '#008055' }}
            >
              <RefreshCw size={12} aria-hidden="true" /> {t('transactions.retry')}
            </button>
          </div>
        )}

        {!isLoading && !error && transactions.length === 0 && (
          <div className="bg-white p-10 text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: '#F0FDFA', border: '1.5px solid #CCFBF1' }}
            >
              <TrendingUp size={28} aria-hidden="true" style={{ color: '#008055' }} />
            </div>
            <p className="text-sm font-bold text-slate-700 mb-1" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              {t('transactions.emptyTitle')}
            </p>
            <p className="text-xs text-slate-400 mb-5">{t('transactions.emptyDesc')}</p>
            <button
              type="button"
              onClick={() => navigate('/vendor/qr')}
              className="inline-flex min-h-11 items-center gap-1.5 text-xs font-bold px-5 rounded-xl active:scale-95 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ backgroundColor: '#008055' }}
            >
              <QrCode size={12} aria-hidden="true" /> {t('transactions.showQr')}
            </button>
          </div>
        )}

        {!isLoading && !error && transactions.length > 0 && searchedTransactions.length === 0 && (
          <div className="bg-white p-10 text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: '#F8FAFC', border: '1.5px solid #E2E8F0' }}
            >
              <Search size={28} style={{ color: '#64748B' }} />
            </div>
            <p className="text-sm font-bold text-slate-700 mb-1" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              {t('transactions.noMatching')}
            </p>
            <p className="text-xs text-slate-400 mb-5">{t('transactions.noMatchingHint')}</p>
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="inline-flex min-h-11 items-center gap-1.5 text-xs font-bold px-5 rounded-xl active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ color: '#008055', backgroundColor: '#F0FDFA', border: '1px solid #CCFBF1' }}
            >
              {t('transactions.clearSearch')}
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
