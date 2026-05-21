import { useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X, HandCoins, AlertTriangle, ScanLine, Keyboard, QrCode, ChevronLeft, Loader2, CheckCircle, ShieldCheck, Download, BarChart3, Database } from 'lucide-react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { useWallet } from '../../lib/hooks/useWallet';
import { useVendorUtangs } from '../../lib/hooks/useUtang';
import { UtangCard } from '../../components/UtangCard';
import { QRScanner } from '../../components/QRScanner';
import { buildPaymentTx, submitTx } from '../../lib/stellar';
import { StellarWalletsKit, Networks } from '@creit.tech/stellar-wallets-kit';
import { WalletRequiredState } from '../../components/WalletRequiredState';
import { buildCollectionsSummary } from '../../lib/vendor-proof';

const ESCROW_ID = import.meta.env.VITE_UTANG_ESCROW_CONTRACT_ID as string | undefined;
const FEE_XLM = import.meta.env.VITE_UTANG_FEE_XLM ?? '1';
const FEE_DEST = 'GBI5W3JPFNGBMW2TCSGTNL3NPW6E423UN4BMAXAU34AXTSMTSDT2JDXH';

const INTERVAL_OPTIONS = [
  { label: 'Weekly', labelTl: 'Lingguwal', days: 7 },
  { label: 'Biweekly', labelTl: 'Dalawang Linggo', days: 14 },
  { label: 'Monthly', labelTl: 'Buwanang', days: 30 },
];
const INSTALLMENT_OPTIONS = [2, 3, 4, 5, 6];
const STROOPS = 10_000_000;

export interface UtangOfferPayload {
  t: 'u';
  v: string;
  c?: string;
  a: number;
  n: number;
  i: number;
  d: string;
}

type Mode = 'qr' | 'manual';
type Step = 'form' | 'fee_payment' | 'qr_display';
type FeeStatus = 'idle' | 'paying' | 'paid' | 'failed';

interface UtangForm {
  customerWallet: string;
  totalAmountXlm: string;
  installmentsTotal: number;
  intervalDays: number;
  description: string;
}

const DEFAULT_FORM: UtangForm = {
  customerWallet: '',
  totalAmountXlm: '',
  installmentsTotal: 3,
  intervalDays: 7,
  description: '',
};

const FILTER_LABELS: Record<string, { en: string; tl: string }> = {
  all:       { en: 'All',       tl: 'Lahat' },
  active:    { en: 'Active',    tl: 'Aktibo' },
  completed: { en: 'Completed', tl: 'Tapos na' },
  defaulted: { en: 'Defaulted', tl: 'Defaulted' },
};

export function VendorUtang() {
  const { address } = useWallet();
  const { utangs, isLoading, error, refetch } = useVendorUtangs(address);

  const [lang, setLang] = useState<'en' | 'tl'>('tl');
  const [showPanel, setShowPanel] = useState(false);
  const [mode, setMode] = useState<Mode>('qr');
  const [step, setStep] = useState<Step>('form');
  const [form, setForm] = useState<UtangForm>(DEFAULT_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [showCustomerScanner, setShowCustomerScanner] = useState(false);
  const [qrPayload, setQrPayload] = useState<UtangOfferPayload | null>(null);
  const [feeStatus, setFeeStatus] = useState<FeeStatus>('idle');
  const [feeError, setFeeError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'defaulted'>('all');
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const active = utangs.filter((u) => u.status === 'active');
  const collectionsSummary = useMemo(() => buildCollectionsSummary(utangs), [utangs]);
  const filtered = filter === 'all' ? utangs : utangs.filter((u) => u.status === filter);
  const totalOwed = active.reduce(
    (sum, u) => sum + (u.totalAmountXlm - u.installmentAmountXlm * u.installmentsPaid),
    0
  );

  const installmentXlm = form.totalAmountXlm && Number(form.totalAmountXlm) > 0
    ? (Number(form.totalAmountXlm) / form.installmentsTotal).toFixed(2)
    : null;

  const owedStr = totalOwed.toFixed(2);
  const owedFontSize = owedStr.length >= 10 ? '1.8rem' : owedStr.length >= 8 ? '2.2rem' : owedStr.length >= 6 ? '2.8rem' : '3.4rem';

  if (!address) {
    return <WalletRequiredState detail="Connect your vendor wallet to create and manage installment agreements." />;
  }

  function validate(): boolean {
    setFormError(null);
    if (!address) { setFormError('Wallet not connected'); return false; }
    if (!form.description.trim()) { setFormError(lang === 'tl' ? 'Ilagay ang mga items' : 'Enter items description'); return false; }
    const amount = parseFloat(form.totalAmountXlm);
    if (!amount || amount <= 0) { setFormError(lang === 'tl' ? 'Ilagay ang tamang halaga' : 'Enter a valid amount'); return false; }
    if (mode === 'manual') {
      if (!form.customerWallet.trim().startsWith('G') || form.customerWallet.trim().length !== 56) {
        setFormError(lang === 'tl' ? 'Ilagay ang wastong Stellar wallet address (G..., 56 chars)' : 'Enter a valid Stellar wallet address (G..., 56 chars)');
        return false;
      }
    }
    return true;
  }

  function handleGenerateQR() {
    if (!validate() || !address) return;
    setFeeStatus('idle');
    setFeeError(null);
    setStep('fee_payment');
  }

  async function handlePayFee() {
    if (!address) return;
    setFeeStatus('paying');
    setFeeError(null);
    try {
      const xdr = await buildPaymentTx(address, FEE_DEST, FEE_XLM, 'PalengkePay utang fee');
      const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
        networkPassphrase: Networks.TESTNET,
        address,
      });
      await submitTx(signedTxXdr);
      setFeeStatus('paid');
      setQrPayload({
        t: 'u',
        v: address,
        c: mode === 'manual' ? form.customerWallet.trim() : undefined,
        a: Math.round(parseFloat(form.totalAmountXlm) * STROOPS),
        n: form.installmentsTotal,
        i: form.intervalDays * 86400,
        d: form.description.trim(),
      });
      setStep('qr_display');
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message ?? String(err);
      setFeeError(
        msg.includes('rejected') || msg.includes('cancel')
          ? (lang === 'tl' ? 'Kinansela ang transaksyon' : 'Transaction cancelled')
          : msg.slice(0, 120)
      );
      setFeeStatus('failed');
    }
  }

  function downloadQR() {
    const canvas = qrCanvasRef.current;
    if (!canvas || !qrPayload) return;
    const link = document.createElement('a');
    link.download = `utang-qr-${qrPayload.d.slice(0, 30).replace(/\s+/g, '-')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  function handleClose() {
    setShowPanel(false);
    setStep('form');
    setForm(DEFAULT_FORM);
    setFormError(null);
    setQrPayload(null);
    setShowCustomerScanner(false);
    setFeeStatus('idle');
    setFeeError(null);
  }

  const stepTitle = step === 'qr_display'
    ? (lang === 'tl' ? 'Ipakita sa Customer' : 'Show QR to Customer')
    : step === 'fee_payment'
    ? (lang === 'tl' ? 'Bayad sa Serbisyo' : 'Service Fee')
    : (lang === 'tl' ? 'Bagong Kasunduan' : 'New Agreement');

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-xl font-black text-slate-900"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            {lang === 'tl' ? 'Utang (BNPL)' : 'Utang (BNPL)'}
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {lang === 'tl' ? 'I-manage ang mga installment' : 'Manage installment agreements'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* EN/TL toggle */}
          <button
            onClick={() => setLang((l) => l === 'en' ? 'tl' : 'en')}
            className="flex items-center text-xs font-bold rounded-full px-2.5 py-1 transition-all"
            style={{
              backgroundColor: 'rgba(15,118,110,0.1)',
              color: '#008055',
              border: '1px solid rgba(15,118,110,0.2)',
            }}
          >
            {lang === 'en' ? 'TL' : 'EN'}
          </button>
          {ESCROW_ID && (
            <button
              onClick={() => { setShowPanel(true); setMode('qr'); setStep('form'); }}
              className="flex items-center gap-1.5 text-white px-4 rounded-xl text-sm font-bold transition-all active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #008055, #0D9488)',
                minHeight: '44px',
                boxShadow: '0 4px 14px rgba(15,118,110,0.35)',
              }}
            >
              <Plus size={15} />
              {lang === 'tl' ? 'Bagong Utang' : 'New Utang'}
            </button>
          )}
        </div>
      </div>

      {/* ── No escrow warning ── */}
      {!ESCROW_ID && (
        <div
          className="rounded-2xl p-4 flex gap-3"
          style={{ backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}
        >
          <AlertTriangle size={18} style={{ color: '#D97706' }} className="shrink-0 mt-0.5" />
          <p className="text-sm" style={{ color: '#92400E' }}>
            {lang === 'tl'
              ? <>I-set ang <code style={{ backgroundColor: 'rgba(245,158,11,0.2)', borderRadius: 4, padding: '0 4px' }}>VITE_UTANG_ESCROW_CONTRACT_ID</code> para ma-enable ang BNPL.</>
              : <>Set <code style={{ backgroundColor: 'rgba(245,158,11,0.2)', borderRadius: 4, padding: '0 4px' }}>VITE_UTANG_ESCROW_CONTRACT_ID</code> to enable BNPL.</>
            }
          </p>
        </div>
      )}

      {/* ── Load error ── */}
      {!isLoading && error && ESCROW_ID && (
        <div
          className="rounded-2xl p-4 flex gap-3"
          style={{ backgroundColor: '#FFF1F2', border: '1.5px solid #FECDD3' }}
        >
          <AlertTriangle size={18} style={{ color: '#F43F5E' }} className="shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-slate-800">
              {lang === 'tl' ? 'Hindi ma-load ang mga kasunduan' : 'Could not load agreements'}
            </p>
            <p className="text-xs font-medium text-rose-600 mt-0.5">{error}</p>
          </div>
          <button
            onClick={refetch}
            className="text-xs font-bold px-3 py-2 rounded-xl active:scale-95 self-start"
            style={{ backgroundColor: 'white', color: '#BE123C', border: '1px solid #FECDD3' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Outstanding hero ── */}
      {active.length > 0 && (
        <div
          className="rounded-3xl p-6 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #D97706, #F59E0B, #FBBF24)' }}
        >
          {/* Banig texture */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.07]"
            style={{
              backgroundImage: `repeating-linear-gradient(
                45deg, white 0px, white 1px, transparent 1px, transparent 10px
              ), repeating-linear-gradient(
                -45deg, white 0px, white 1px, transparent 1px, transparent 10px
              )`,
            }}
          />
          {/* Watermark */}
          <div
            className="absolute pointer-events-none select-none font-black"
            style={{
              right: -8, bottom: -16, fontSize: 96,
              color: 'rgba(255,255,255,0.12)',
              fontFamily: "'Montserrat', sans-serif",
              lineHeight: 1,
            }}
          >
            ₱
          </div>

          <p
            className="text-xs font-bold uppercase tracking-widest mb-2 relative"
            style={{ color: 'rgba(120,53,15,0.7)' }}
          >
            {lang === 'tl' ? 'Kabuuang Natatanggap' : 'Total Outstanding'}
          </p>
          <p
            className="font-black leading-none relative"
            style={{
              fontSize: owedFontSize,
              color: '#431407',
              fontFamily: "'Montserrat', sans-serif",
            }}
          >
            {owedStr}
            <span className="text-base font-bold ml-2" style={{ color: 'rgba(120,53,15,0.6)' }}>XLM</span>
          </p>
          <p className="text-sm font-semibold mt-2 relative" style={{ color: 'rgba(120,53,15,0.7)' }}>
            {active.length} {lang === 'tl' ? `aktibong kasunduan${active.length !== 1 ? '' : ''}` : `active agreement${active.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      )}

      {/* ── Collections reporting ── */}
      <section
        className="rounded-3xl p-5 space-y-4"
        style={{ backgroundColor: 'white', border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 2px 16px rgba(0,0,0,0.05)' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 size={18} style={{ color: '#D97706' }} />
              <h2 className="text-base font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                {lang === 'tl' ? 'Collections Report' : 'Collections Report'}
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              {lang === 'tl'
                ? 'Buod ng aktibo, tapos, overdue, at defaulted na kasunduan.'
                : 'Summary of active, completed, overdue, and defaulted agreements.'}
            </p>
          </div>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black shrink-0"
            style={{ backgroundColor: '#FFFBEB', color: '#B45309', border: '1px solid #FDE68A' }}
          >
            <Database size={12} />
            {collectionsSummary.sourceLabel}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Active', value: collectionsSummary.activeAgreements },
            { label: 'Completed', value: collectionsSummary.completedAgreements },
            { label: 'Overdue', value: collectionsSummary.overdueAgreements },
            { label: 'Defaulted', value: collectionsSummary.defaultedAgreements },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-2xl p-3" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <p className="text-xs font-bold text-slate-400 mb-1">{label}</p>
              <p className="text-lg font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>{value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl p-4" style={{ backgroundColor: '#FFF7ED', border: '1px solid #FED7AA' }}>
            <p className="text-xs font-bold mb-1" style={{ color: '#C2410C' }}>Outstanding</p>
            <p className="text-xl font-black" style={{ color: '#9A3412', fontFamily: "'Montserrat', sans-serif" }}>
              {collectionsSummary.totalOutstandingXlm.toFixed(2)}
              <span className="text-xs font-bold ml-1">XLM</span>
            </p>
          </div>
          <div className="rounded-2xl p-4" style={{ backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0' }}>
            <p className="text-xs font-bold mb-1" style={{ color: '#047857' }}>Collected</p>
            <p className="text-xl font-black" style={{ color: '#065F46', fontFamily: "'Montserrat', sans-serif" }}>
              {collectionsSummary.totalCollectedXlm.toFixed(2)}
              <span className="text-xs font-bold ml-1">XLM</span>
            </p>
          </div>
        </div>

        <div className="rounded-2xl p-3" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          {collectionsSummary.caveats.map((caveat) => (
            <p key={caveat} className="text-xs text-slate-500">- {caveat}</p>
          ))}
        </div>
      </section>

      {/* ── Filter tabs ── */}
      {utangs.length > 0 && (
        <div
          className="flex gap-1 p-1 rounded-2xl"
          style={{ backgroundColor: 'rgba(15,23,42,0.06)' }}
        >
          {(['all', 'active', 'completed', 'defaulted'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="flex-1 text-xs font-bold rounded-xl capitalize transition-all"
              style={{
                minHeight: '40px',
                backgroundColor: filter === f ? 'white' : 'transparent',
                color: filter === f ? '#008055' : 'rgba(15,23,42,0.4)',
                boxShadow: filter === f ? '0 1px 6px rgba(0,0,0,0.12)' : 'none',
              }}
            >
              {FILTER_LABELS[f][lang]}
            </button>
          ))}
        </div>
      )}

      {/* ── Loading skeletons ── */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="rounded-2xl h-36 animate-pulse"
              style={{ backgroundColor: 'rgba(15,23,42,0.06)' }}
            />
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {!isLoading && !error && filtered.length === 0 && ESCROW_ID && (
        <div
          className="rounded-3xl p-8 text-center"
          style={{ backgroundColor: 'white', border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 2px 16px rgba(0,0,0,0.05)' }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(251,191,36,0.2))' }}
          >
            <HandCoins size={28} style={{ color: '#D97706' }} />
          </div>
          <p className="text-sm font-bold text-slate-700 mb-1">
            {filter === 'all'
              ? (lang === 'tl' ? 'Walang kasunduan pa' : 'No agreements yet')
              : (lang === 'tl' ? `Walang ${FILTER_LABELS[filter].tl.toLowerCase()} na kasunduan` : `No ${filter} agreements`)
            }
          </p>
          {filter === 'all' && (
            <>
              <p className="text-xs text-slate-400 mb-5">
                {lang === 'tl'
                  ? 'Gumawa ng installment para sa customer via QR o manual'
                  : 'Create an installment agreement for a customer via QR or manual entry'}
              </p>
              <button
                onClick={() => { setShowPanel(true); setMode('qr'); setStep('form'); }}
                className="inline-flex items-center gap-2 text-xs font-bold px-5 py-2.5 rounded-full transition-all active:scale-95"
                style={{
                  backgroundColor: 'rgba(15,118,110,0.1)',
                  color: '#008055',
                }}
              >
                <Plus size={13} />
                {lang === 'tl' ? 'Bagong Utang' : 'New Utang'}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Utang cards ── */}
      {!isLoading && !error && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((u) => <UtangCard key={String(u.id)} utang={u} perspective="vendor" />)}
        </div>
      )}

      {/* ── New Utang bottom sheet ── */}
      {showPanel && createPortal(
        <div
          className="fixed inset-0 z-50 flex flex-col items-end justify-end"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div
            className="w-full rounded-t-3xl overflow-hidden flex flex-col"
            style={{
              backgroundColor: '#F8FAFB',
              maxHeight: '95dvh',
              boxShadow: '0 -16px 64px rgba(0,0,0,0.25)',
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'rgba(15,23,42,0.15)' }} />
            </div>

            {/* Sheet header */}
            <div
              className="flex items-center gap-3 px-5 py-4 shrink-0"
              style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}
            >
              <button
                onClick={() => {
                  if (step === 'qr_display') { setStep('form'); setQrPayload(null); }
                  else if (step === 'fee_payment' && feeStatus !== 'paying') { setStep('form'); setFeeStatus('idle'); setFeeError(null); }
                  else if (step === 'form') handleClose();
                }}
                className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-95 shrink-0"
                style={{ backgroundColor: 'rgba(15,23,42,0.07)' }}
              >
                {step === 'form'
                  ? <X size={16} style={{ color: 'rgba(15,23,42,0.5)' }} />
                  : <ChevronLeft size={16} style={{ color: 'rgba(15,23,42,0.5)' }} />
                }
              </button>
              <h2
                className="text-base font-black text-slate-900"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              >
                {stepTitle}
              </h2>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 px-5 py-5 space-y-4" style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>

              {/* ── Form step ── */}
              {step === 'form' && (
                <>
                  {/* Mode selector */}
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { id: 'qr' as Mode, icon: QrCode, titleEn: 'QR Code', titleTl: 'QR Code', subEn: 'Customer scans your screen', subTl: 'I-scan ng customer ang screen mo' },
                      { id: 'manual' as Mode, icon: Keyboard, titleEn: 'Manual Entry', titleTl: 'Manual Entry', subEn: 'Type / scan customer wallet', subTl: 'I-type o i-scan ang wallet' },
                    ]).map(({ id, icon: Icon, titleEn, titleTl, subEn, subTl }) => (
                      <button
                        key={id}
                        onClick={() => { setMode(id); setShowCustomerScanner(false); }}
                        className="flex flex-col items-center gap-2 p-4 rounded-2xl transition-all active:scale-[0.97] text-center"
                        style={{
                          border: mode === id ? '2px solid #008055' : '2px solid rgba(15,23,42,0.1)',
                          backgroundColor: mode === id ? 'rgba(15,118,110,0.08)' : 'white',
                          minHeight: '90px',
                        }}
                      >
                        <Icon size={24} style={{ color: mode === id ? '#008055' : 'rgba(15,23,42,0.4)' }} />
                        <div>
                          <p className="text-sm font-bold" style={{ color: mode === id ? '#008055' : '#1e293b' }}>
                            {lang === 'tl' ? titleTl : titleEn}
                          </p>
                          <p className="text-xs leading-tight mt-0.5" style={{ color: 'rgba(15,23,42,0.4)' }}>
                            {lang === 'tl' ? subTl : subEn}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div
                    className="rounded-2xl p-5 space-y-4"
                    style={{ backgroundColor: 'white', border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}
                  >
                    {/* Customer wallet (manual mode) */}
                    {mode === 'manual' && (
                      <div>
                        <label className="block text-xs font-bold mb-1.5" style={{ color: '#008055' }}>
                          {lang === 'tl' ? 'Customer Wallet Address' : 'Customer Wallet Address'}
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="G..."
                            value={form.customerWallet}
                            onChange={(e) => setForm((f) => ({ ...f, customerWallet: e.target.value }))}
                            className="flex-1 rounded-xl px-4 text-sm font-mono focus:outline-none"
                            style={{
                              border: '1.5px solid rgba(15,23,42,0.15)',
                              minHeight: '48px',
                              backgroundColor: 'rgba(15,23,42,0.02)',
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowCustomerScanner((s) => !s)}
                            className="flex items-center justify-center rounded-xl transition-all active:scale-95"
                            style={{
                              minWidth: 48, minHeight: 48,
                              border: showCustomerScanner ? 'none' : '1.5px solid rgba(15,23,42,0.15)',
                              backgroundColor: showCustomerScanner ? '#008055' : 'rgba(15,23,42,0.03)',
                              color: showCustomerScanner ? 'white' : 'rgba(15,23,42,0.4)',
                            }}
                          >
                            <ScanLine size={16} />
                          </button>
                        </div>
                        {showCustomerScanner && (
                          <div
                            className="mt-3 rounded-2xl overflow-hidden"
                            style={{ border: '1.5px solid rgba(15,23,42,0.1)', backgroundColor: '#00284B' }}
                          >
                            <div
                              className="flex items-center justify-between px-4 py-3"
                              style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
                            >
                              <p className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.6)' }}>
                                {lang === 'tl' ? 'I-scan ang wallet ng customer' : "Scan customer's wallet QR"}
                              </p>
                              <button
                                onClick={() => setShowCustomerScanner(false)}
                                style={{ color: 'rgba(255,255,255,0.4)' }}
                              >
                                <X size={14} />
                              </button>
                            </div>
                            <QRScanner onScan={(addr) => { setForm((f) => ({ ...f, customerWallet: addr })); setShowCustomerScanner(false); }} />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Items description */}
                    <div>
                      <label className="block text-xs font-bold mb-1.5" style={{ color: '#008055' }}>
                        {lang === 'tl' ? 'Mga Items' : 'Items'}
                        <span className="font-normal ml-1" style={{ color: 'rgba(15,23,42,0.35)' }}>
                          {lang === 'tl' ? '(binibili nila sa credit)' : '(what they\'re buying on credit)'}
                        </span>
                      </label>
                      <input
                        type="text"
                        placeholder={lang === 'tl' ? 'hal. 5kg bigas, 2kg baboy, gulay' : 'e.g. 5kg rice, 2kg pork, vegetables'}
                        maxLength={100}
                        value={form.description}
                        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                        className="w-full rounded-xl px-4 text-sm focus:outline-none"
                        style={{
                          border: '1.5px solid rgba(15,23,42,0.15)',
                          minHeight: '48px',
                          backgroundColor: 'rgba(15,23,42,0.02)',
                        }}
                      />
                    </div>

                    {/* Amount */}
                    <div>
                      <label className="block text-xs font-bold mb-1.5" style={{ color: '#008055' }}>
                        {lang === 'tl' ? 'Kabuuang Halaga (XLM)' : 'Total Amount (XLM)'}
                      </label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="0.00"
                        value={form.totalAmountXlm}
                        onChange={(e) => setForm((f) => ({ ...f, totalAmountXlm: e.target.value }))}
                        className="w-full rounded-xl px-4 text-sm focus:outline-none"
                        style={{
                          border: '1.5px solid rgba(15,23,42,0.15)',
                          minHeight: '48px',
                          backgroundColor: 'rgba(15,23,42,0.02)',
                        }}
                      />
                    </div>

                    {/* Installments + Interval */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold mb-1.5" style={{ color: '#008055' }}>
                          {lang === 'tl' ? 'Installments' : 'Installments'}
                        </label>
                        <select
                          value={form.installmentsTotal}
                          onChange={(e) => setForm((f) => ({ ...f, installmentsTotal: Number(e.target.value) }))}
                          className="w-full rounded-xl px-3 text-sm focus:outline-none"
                          style={{
                            border: '1.5px solid rgba(15,23,42,0.15)',
                            minHeight: '48px',
                            backgroundColor: 'rgba(15,23,42,0.02)',
                          }}
                        >
                          {INSTALLMENT_OPTIONS.map((n) => <option key={n} value={n}>{n}x</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold mb-1.5" style={{ color: '#008055' }}>
                          {lang === 'tl' ? 'Agwat' : 'Interval'}
                        </label>
                        <select
                          value={form.intervalDays}
                          onChange={(e) => setForm((f) => ({ ...f, intervalDays: Number(e.target.value) }))}
                          className="w-full rounded-xl px-3 text-sm focus:outline-none"
                          style={{
                            border: '1.5px solid rgba(15,23,42,0.15)',
                            minHeight: '48px',
                            backgroundColor: 'rgba(15,23,42,0.02)',
                          }}
                        >
                          {INTERVAL_OPTIONS.map((o) => (
                            <option key={o.days} value={o.days}>
                              {lang === 'tl' ? o.labelTl : o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Preview */}
                    {installmentXlm && form.description && (
                      <div
                        className="rounded-xl px-4 py-3"
                        style={{ backgroundColor: 'rgba(15,118,110,0.07)', border: '1px solid rgba(15,118,110,0.15)' }}
                      >
                        <p className="text-xs font-bold" style={{ color: '#008055' }}>{form.description}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'rgba(15,118,110,0.7)' }}>
                          {form.installmentsTotal} × {installmentXlm} XLM · {INTERVAL_OPTIONS.find((o) => o.days === form.intervalDays)?.[lang === 'tl' ? 'labelTl' : 'label'].toLowerCase()}
                        </p>
                      </div>
                    )}

                    {formError && (
                      <div
                        className="rounded-xl px-4 py-3 text-xs font-semibold"
                        style={{ backgroundColor: 'rgba(244,63,94,0.08)', color: '#be123c', border: '1px solid rgba(244,63,94,0.2)' }}
                      >
                        {formError}
                      </div>
                    )}
                  </div>

                  {/* CTA */}
                  {mode === 'qr' ? (
                    <button
                      onClick={handleGenerateQR}
                      className="w-full flex items-center justify-center gap-2 text-white font-bold rounded-2xl transition-all active:scale-[0.98]"
                      style={{
                        background: 'linear-gradient(135deg, #008055, #0D9488)',
                        minHeight: '56px',
                        fontSize: '0.9rem',
                        boxShadow: '0 4px 18px rgba(15,118,110,0.4)',
                      }}
                    >
                      <QrCode size={17} />
                      {lang === 'tl' ? 'I-generate ang QR Code' : 'Generate QR Code'}
                    </button>
                  ) : (
                    <button
                      onClick={handleGenerateQR}
                      className="w-full flex items-center justify-center gap-2 text-white font-bold rounded-2xl transition-all active:scale-[0.98] disabled:opacity-50"
                      style={{
                        background: 'linear-gradient(135deg, #008055, #0D9488)',
                        minHeight: '56px',
                        fontSize: '0.9rem',
                        boxShadow: '0 4px 18px rgba(15,118,110,0.4)',
                      }}
                    >
                      <QrCode size={17} />
                      {lang === 'tl' ? 'Gumawa ng Customer QR' : 'Create Customer QR'}
                    </button>
                  )}
                </>
              )}

              {/* ── Fee payment step ── */}
              {step === 'fee_payment' && (
                <div className="space-y-4">
                  {/* Summary card — dark teal */}
                  <div
                    className="rounded-2xl p-5 space-y-3 relative overflow-hidden"
                    style={{ background: 'linear-gradient(135deg, #00284B, #008055)' }}
                  >
                    <div
                      className="absolute inset-0 pointer-events-none opacity-[0.05]"
                      style={{
                        backgroundImage: `repeating-linear-gradient(
                          45deg, white 0px, white 1px, transparent 1px, transparent 10px
                        ), repeating-linear-gradient(
                          -45deg, white 0px, white 1px, transparent 1px, transparent 10px
                        )`,
                      }}
                    />
                    <p
                      className="text-xs font-bold uppercase tracking-widest relative"
                      style={{ color: 'rgba(255,255,255,0.5)' }}
                    >
                      {lang === 'tl' ? 'Buod ng Kasunduan' : 'Agreement Summary'}
                    </p>
                    <p className="text-base font-bold text-white relative">{form.description}</p>
                    <div className="space-y-2 relative">
                      {[
                        {
                          label: lang === 'tl' ? 'Kabuuang halaga' : 'Total amount',
                          value: `${form.totalAmountXlm} XLM`,
                        },
                        {
                          label: lang === 'tl' ? 'Installments' : 'Installments',
                          value: `${form.installmentsTotal} × ${(Number(form.totalAmountXlm) / form.installmentsTotal).toFixed(2)} XLM`,
                        },
                        {
                          label: lang === 'tl' ? 'Agwat' : 'Interval',
                          value: INTERVAL_OPTIONS.find((o) => o.days === form.intervalDays)?.[lang === 'tl' ? 'labelTl' : 'label'] ?? '',
                        },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex items-center justify-between text-sm">
                          <span style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</span>
                          <span className="font-bold text-white">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Fee card — amber */}
                  <div
                    className="rounded-2xl p-5 space-y-3"
                    style={{ backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={18} style={{ color: '#D97706' }} className="shrink-0" />
                      <p className="text-sm font-bold" style={{ color: '#92400E' }}>
                        {lang === 'tl' ? 'Bayad sa Serbisyo ng PalengkePay' : 'PalengkePay Service Fee'}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm" style={{ color: '#B45309' }}>
                        {lang === 'tl' ? 'Bayad sa paglikha ng QR utang' : 'QR utang creation fee'}
                      </span>
                      <span
                        className="font-black"
                        style={{ fontSize: '1.6rem', color: '#92400E', fontFamily: "'Montserrat', sans-serif" }}
                      >
                        {FEE_XLM} XLM
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: 'rgba(146,64,14,0.7)' }}>
                      {lang === 'tl'
                        ? 'One-time fee bawat QR na kasunduan. Bayad sa PalengkePay para ma-register on-chain.'
                        : 'One-time fee per QR agreement. Paid to PalengkePay to register this installment on-chain.'}
                    </p>
                  </div>

                  {feeError && (
                    <div
                      className="rounded-xl px-4 py-3 text-xs font-semibold"
                      style={{ backgroundColor: 'rgba(244,63,94,0.08)', color: '#be123c', border: '1px solid rgba(244,63,94,0.2)' }}
                    >
                      {feeError}
                    </div>
                  )}

                  {feeStatus !== 'paying' ? (
                    <button
                      onClick={handlePayFee}
                      className="w-full flex items-center justify-center gap-2 text-white font-bold rounded-2xl transition-all active:scale-[0.98]"
                      style={{
                        background: 'linear-gradient(135deg, #008055, #0D9488)',
                        minHeight: '56px',
                        fontSize: '0.9rem',
                        boxShadow: '0 4px 18px rgba(15,118,110,0.4)',
                      }}
                    >
                      <CheckCircle size={17} />
                      {lang === 'tl'
                        ? `Bayaran ang ${FEE_XLM} XLM at I-generate ang QR`
                        : `Pay ${FEE_XLM} XLM & Generate QR`}
                    </button>
                  ) : (
                    <div
                      className="w-full flex items-center justify-center gap-2 text-white font-bold rounded-2xl"
                      style={{
                        background: 'linear-gradient(135deg, rgba(15,118,110,0.7), rgba(13,148,136,0.7))',
                        minHeight: '56px',
                        fontSize: '0.9rem',
                      }}
                    >
                      <Loader2 size={17} className="animate-spin" />
                      {lang === 'tl' ? 'Kumpirmahin sa wallet…' : 'Confirm in wallet…'}
                    </div>
                  )}
                </div>
              )}

              {/* ── QR display step ── */}
              {step === 'qr_display' && qrPayload && (
                <div className="space-y-4">
                  {/* Hidden canvas for download */}
                  <QRCodeCanvas
                    ref={qrCanvasRef}
                    value={JSON.stringify(qrPayload)}
                    size={440}
                    level="M"
                    bgColor="#ffffff"
                    fgColor="#0f172a"
                    style={{ display: 'none' }}
                  />

                  {/* QR card */}
                  <div
                    className="rounded-3xl p-6 flex flex-col items-center gap-4"
                    style={{
                      backgroundColor: 'white',
                      border: '1px solid rgba(15,23,42,0.08)',
                      boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
                    }}
                  >
                    <div
                      className="p-3 rounded-2xl"
                      style={{ border: '2px solid rgba(15,118,110,0.2)', backgroundColor: 'white' }}
                    >
                      <QRCodeSVG
                        value={JSON.stringify(qrPayload)}
                        size={220}
                        level="M"
                        bgColor="#ffffff"
                        fgColor="#0f172a"
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-base font-bold text-slate-900">{qrPayload.d}</p>
                      <p className="text-sm mt-1" style={{ color: 'rgba(15,23,42,0.45)' }}>
                        {(qrPayload.a / STROOPS).toFixed(2)} XLM · {qrPayload.n} × {(qrPayload.a / STROOPS / qrPayload.n).toFixed(2)} XLM · {INTERVAL_OPTIONS.find((o) => o.days * 86400 === qrPayload.i)?.[lang === 'tl' ? 'labelTl' : 'label'] ?? ''}
                      </p>
                    </div>
                  </div>

                  {/* Download */}
                  <button
                    onClick={downloadQR}
                    className="w-full flex items-center justify-center gap-2 text-white font-bold rounded-2xl transition-all active:scale-[0.98]"
                    style={{
                      background: 'linear-gradient(135deg, #008055, #0D9488)',
                      minHeight: '56px',
                      fontSize: '0.9rem',
                      boxShadow: '0 4px 18px rgba(15,118,110,0.4)',
                    }}
                  >
                    <Download size={17} />
                    {lang === 'tl' ? 'I-download ang QR Image' : 'Download QR Image'}
                  </button>

                  {/* How it works */}
                  <div
                    className="rounded-2xl p-4 space-y-2"
                    style={{ backgroundColor: 'rgba(15,118,110,0.07)', border: '1px solid rgba(15,118,110,0.12)' }}
                  >
                    <p className="text-sm font-bold" style={{ color: '#008055' }}>
                      {lang === 'tl' ? 'Paano ito gumagana' : 'How it works'}
                    </p>
                    <ol className="text-xs space-y-1 list-decimal list-inside" style={{ color: 'rgba(15,118,110,0.8)' }}>
                      {lang === 'tl' ? (
                        <>
                          <li>Ipakita itong QR sa iyong customer</li>
                          <li>Buksan ng customer ang PalengkePay → My Utang → i-tap ang Scan</li>
                          <li>Tingnan ng customer ang detalye at i-tap ang Tanggapin</li>
                          <li>Awtomatikong nai-register ang kasunduan on-chain</li>
                        </>
                      ) : (
                        <>
                          <li>Show this QR to your customer</li>
                          <li>Customer opens PalengkePay → My Utang → tap Scan</li>
                          <li>Customer reviews details and taps Accept</li>
                          <li>Agreement registers on-chain automatically</li>
                        </>
                      )}
                    </ol>
                  </div>

                  <button
                    onClick={handleClose}
                    className="w-full font-bold rounded-2xl transition-all active:scale-[0.98]"
                    style={{
                      minHeight: '52px',
                      fontSize: '0.9rem',
                      border: '1.5px solid rgba(15,23,42,0.12)',
                      color: 'rgba(15,23,42,0.55)',
                      backgroundColor: 'white',
                    }}
                  >
                    {lang === 'tl' ? 'Isara' : 'Done'}
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
