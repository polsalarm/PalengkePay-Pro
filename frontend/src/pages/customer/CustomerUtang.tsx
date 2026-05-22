import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HandCoins, CheckCircle, Loader2, X, ExternalLink, AlertTriangle, ScanLine, ImageUp, RotateCcw, ShieldOff } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { useWallet } from '../../lib/hooks/useWallet';
import { useCustomerUtangs, usePayInstallment, useCreateUtang, useResumeAfterLate, useCustomerDefaults } from '../../lib/hooks/useUtang';
import type { UtangRecord } from '../../lib/hooks/useUtang';
import type { UtangOfferPayload } from '../vendor/VendorUtang';
import { UtangCard } from '../../components/UtangCard';
import { RatingPrompt } from '../../components/RatingPrompt';
import { stellarExpertUrl, truncateAddress } from '../../lib/stellar';
import { WalletRequiredState } from '../../components/WalletRequiredState';
import { ESCROW_CONTRACT_ID } from '../../lib/contracts';
import { useLanguage } from '../../contexts/LanguageContext';

const STROOPS = 10_000_000;
const INTERVAL_LABELS: Record<number, { en: string; tl: string }> = {
  604800: { en: 'weekly', tl: 'lingguhan' },
  1209600: { en: 'biweekly', tl: 'bawat dalawang linggo' },
  2592000: { en: 'monthly', tl: 'buwanan' },
};
function intervalLabel(secs: number, t: (key: string, params?: Record<string, string | number>) => string) {
  const label = INTERVAL_LABELS[secs];
  if (label) return t(`customerUtang.interval.${label.en}`);
  return t('customerUtang.interval.every', { days: Math.round(secs / 86400) });
}
const UTANG_FILE_DIV = 'qr-utang-file-scanner';

export function CustomerUtang() {
  const { address } = useWallet();
  const { utangs, isLoading, error: fetchError, refetch } = useCustomerUtangs(address);
  const { status, txHash, error, payInstallment, reset } = usePayInstallment();
  const { createUtang, isCreating } = useCreateUtang();
  const { t } = useLanguage();
  const { count: defaultsCount, refetch: refetchDefaults } = useCustomerDefaults(address);
  const { resumeAfterLate, isResuming, error: resumeError, txHash: resumeTxHash } = useResumeAfterLate();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [paying, setPaying] = useState<UtangRecord | null>(null);
  const [resuming, setResuming] = useState<UtangRecord | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'defaulted'>('active');
  const [uploadedOffer, setUploadedOffer] = useState<UtangOfferPayload | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [offerAcceptStatus, setOfferAcceptStatus] = useState<'idle' | 'signing' | 'confirmed' | 'failed'>('idle');
  const [offerTxHash, setOfferTxHash] = useState<string | null>(null);
  const [offerError, setOfferError] = useState<string | null>(null);

  const handleUploadQR = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploadLoading(true);
    setUploadError(null);

    let div = document.getElementById(UTANG_FILE_DIV);
    if (!div) {
      div = document.createElement('div');
      div.id = UTANG_FILE_DIV;
      div.style.display = 'none';
      document.body.appendChild(div);
    }

    const scanner = new Html5Qrcode(UTANG_FILE_DIV);
    try {
      const raw = (await scanner.scanFile(file, false)).trim();
      const parsed = JSON.parse(raw) as UtangOfferPayload;
      if (parsed.t === 'u' && parsed.v && parsed.a && parsed.n && parsed.i) {
        setUploadedOffer(parsed);
        setOfferAcceptStatus('idle');
        setOfferTxHash(null);
        setOfferError(null);
      } else {
        setUploadError(t('customerUtang.uploadErrorInvalid'));
        setTimeout(() => setUploadError(null), 5000);
      }
    } catch {
      setUploadError(t('customerUtang.uploadErrorRead'));
      setTimeout(() => setUploadError(null), 5000);
    } finally {
      setUploadLoading(false);
      try { await scanner.clear(); } catch (clearError) {
        void clearError;
      }
    }
  };

  const handleAcceptOffer = async () => {
    if (!uploadedOffer || !address) return;
    if (uploadedOffer.c && uploadedOffer.c !== address) {
      setOfferError(t('customerUtang.offerWrongWallet'));
      setOfferAcceptStatus('failed');
      return;
    }
    setOfferAcceptStatus('signing');
    setOfferError(null);
    const hash = await createUtang(
      {
        vendorWallet: uploadedOffer.v,
        customerWallet: address,
        totalAmountXlm: uploadedOffer.a / STROOPS,
        installmentsTotal: uploadedOffer.n,
        intervalDays: Math.round(uploadedOffer.i / 86400),
        description: uploadedOffer.d ?? '',
      },
      address
    );
    if (hash) {
      setOfferTxHash(hash);
      setOfferAcceptStatus('confirmed');
      refetch();
    } else {
      setOfferError(t('customerUtang.offerFailed'));
      setOfferAcceptStatus('failed');
    }
  };

  const active = utangs.filter((u) => u.status === 'active');
  const filtered = filter === 'all' ? utangs : utangs.filter((u) => u.status === filter);
  const totalDue = active.reduce((sum, u) => sum + u.installmentAmountXlm, 0);

  function handlePayClick(utang: UtangRecord) {
    if (!address) return;
    setPaying(utang);
    reset();
  }

  async function confirmPay() {
    if (!paying || !address) return;
    await payInstallment(paying, address);
    refetch();
  }

  function handleClosePayModal() {
    if (status === 'building' || status === 'signing' || status === 'submitting') return;
    setPaying(null);
    reset();
  }

  async function confirmResume() {
    if (!resuming || !address) return;
    const hash = await resumeAfterLate(address, resuming.id);
    if (hash) {
      refetch();
      refetchDefaults();
    }
  }

  if (!address) {
    return <WalletRequiredState detail={t('customerUtang.connectWalletDetail')} />;
  }

  return (
    <div className="space-y-4 animate-page-in" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1
            className="text-xl font-black text-slate-900 leading-tight"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            {t('customerUtang.title')}
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-sm text-slate-400">{t('customerUtang.subtitle')}</p>
            {defaultsCount > 0 && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: '#FFF1F2', color: '#BE123C', border: '1px solid #FECDD3' }}
                title="Defaults on-chain across all vendors"
              >
                <ShieldOff size={9} />
                {defaultsCount} default{defaultsCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadLoading}
          className="flex items-center gap-2 text-sm font-bold px-4 rounded-2xl active:scale-95 transition-all disabled:opacity-50"
          style={{
            minHeight: '44px',
            color: '#008055',
            backgroundColor: '#F0FDFA',
            border: '1.5px solid #CCFBF1',
          }}
        >
          <ImageUp size={15} />
          {uploadLoading ? t('customerUtang.reading') : t('customerUtang.uploadQR')}
        </button>
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUploadQR} />

      {/* Rest of the file remains the same as your version... */}
      {/* (Continue with the rest of your file - the bottom sheets, etc.) */}
   
      {/* ── Upload error ── */}
      {uploadError && (
        <div
          className="rounded-2xl px-4 py-3 text-sm font-semibold"
          style={{ backgroundColor: '#FFF1F2', color: '#F43F5E', border: '1.5px solid #FECDD3' }}
        >
          {uploadError}
        </div>
      )}

      {!ESCROW_CONTRACT_ID && (
        <div
          className="rounded-2xl p-4 flex gap-3"
          style={{ backgroundColor: '#FFFBEB', border: '1.5px solid #FDE68A' }}
        >
          <AlertTriangle size={18} className="shrink-0 mt-0.5" style={{ color: '#D97706' }} />
          <div>
            <p className="text-sm font-black text-slate-800">{t('customerUtang.contractNotConfigured')}</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {t('customerUtang.contractHint')}
            </p>
          </div>
        </div>
      )}

      {/* ── Load error ── */}
      {!isLoading && fetchError && ESCROW_CONTRACT_ID && (
        <div
          className="rounded-2xl p-4 flex gap-3"
          style={{ backgroundColor: '#FFF1F2', color: '#BE123C', border: '1.5px solid #FECDD3' }}
        >
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-rose-800">{t('customerUtang.loadFailed')}</p>
            <p className="text-xs font-medium mt-0.5 text-rose-600">{fetchError}</p>
          </div>
          <button
            onClick={refetch}
            className="text-xs font-bold px-3 py-2 rounded-xl active:scale-95 self-start"
            style={{ backgroundColor: 'white', color: '#BE123C', border: '1px solid #FECDD3' }}
          >
            {t('customerUtang.retry')}
          </button>
        </div>
      )}

      {/* ── Due summary hero ── */}
      {active.length > 0 && (
        <div
          className="relative rounded-3xl p-5 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #D97706 0%, #F59E0B 50%, #FBBF24 100%)' }}
        >
          {/* Texture */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.06]"
            style={{
              backgroundImage: `repeating-linear-gradient(
                45deg, white 0px, white 1px, transparent 1px, transparent 10px
              )`,
            }}
          />
          {/* ₱ watermark */}
          <div
            className="absolute select-none pointer-events-none font-black"
            style={{
              fontSize: '9rem', lineHeight: 1,
              color: 'rgba(255,255,255,0.08)',
              bottom: -15, right: -5,
              fontFamily: "'Montserrat', sans-serif",
            }}
          >₱</div>

          <div className="relative">
            <p
              className="text-xs font-bold uppercase tracking-[0.18em] mb-2"
              style={{ color: 'rgba(255,255,255,0.65)' }}
            >
              {t('customerUtang.totalDue')}
            </p>
            <div className="flex items-baseline gap-2 mb-3">
              <span
                className="font-black text-white leading-none"
                style={{
                  fontSize: totalDue.toFixed(2).length >= 8 ? '2.4rem' : '3rem',
                  fontFamily: "'Montserrat', sans-serif",
                  letterSpacing: '-0.02em',
                }}
              >
                {totalDue.toFixed(2)}
              </span>
              <span className="text-lg font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>XLM</span>
            </div>
            <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.65)' }}>
              {t('customerUtang.activePlans', { count: active.length })}
            </p>
          </div>
        </div>
      )}

      {/* ── Filter tabs ── */}
      {utangs.length > 0 && (
        <div
          className="flex gap-1 p-1 rounded-2xl"
          style={{ backgroundColor: '#F1F5F9' }}
        >
          {(['active', 'defaulted', 'completed', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="flex-1 text-xs font-bold rounded-xl capitalize transition-all active:scale-95"
              style={{
                minHeight: '40px',
                backgroundColor: filter === f ? 'white' : 'transparent',
                color: filter === f ? '#0F172A' : '#94A3B8',
                boxShadow: filter === f ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {t(`customerUtang.filter.${f}`)}
            </button>
          ))}
        </div>
      )}

      {/* ── Loading ── */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-5 space-y-3" style={{ border: '1.5px solid #F1F5F9' }}>
              <div className="h-4 w-32 skeleton rounded-lg" />
              <div className="h-3 w-48 skeleton rounded-lg" />
              <div className="h-2.5 w-full skeleton rounded-full" />
              <div className="flex justify-between">
                <div className="h-3 w-20 skeleton rounded-lg" />
                <div className="h-3 w-16 skeleton rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {!isLoading && !fetchError && filtered.length === 0 && (
        <div
          className="rounded-3xl p-8 text-center"
          style={{ backgroundColor: 'white', border: '1.5px solid #F1F5F9' }}
        >
          <div
            className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: '#FEF3C7', border: '2px solid #FDE68A' }}
          >
            <HandCoins size={28} style={{ color: '#D97706' }} />
          </div>
          <p
            className="text-base font-black text-slate-800 mb-1"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            {filter === 'active' ? t('customerUtang.emptyActive') : t('customerUtang.emptyFiltered', { filter: t(`customerUtang.filter.${filter}`) })}
          </p>
          <p className="text-sm text-slate-500 mb-5">
            {t('customerUtang.emptyDesc')}
          </p>
          <div className="flex items-center justify-center gap-4">
            <div
              className="flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl"
              style={{ color: '#008055', backgroundColor: '#F0FDFA' }}
            >
              <ScanLine size={14} /> {t('customerUtang.scanQR')}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl active:scale-95"
              style={{ color: '#D97706', backgroundColor: '#FEF3C7' }}
            >
              <ImageUp size={14} /> {t('customerUtang.uploadQR')}
            </button>
          </div>
        </div>
      )}

      {/* ── Utang cards ── */}
      {!isLoading && !fetchError && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((u) => (
            <UtangCard
              key={String(u.id)}
              utang={u}
              perspective="customer"
              onPayInstallment={handlePayClick}
              onResume={(target) => setResuming(target)}
              busy={isResuming && resuming?.id === u.id}
              txHash={paying?.id === u.id && txHash ? txHash : null}
            />
          ))}
        </div>
      )}

      {/* ── Uploaded offer bottom sheet ── */}
      {uploadedOffer && createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div
            className="w-full rounded-t-3xl overflow-hidden"
            style={{ backgroundColor: 'white', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: '#E2E8F0' }} />
            </div>

            <div className="px-5 pt-2 pb-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#D97706' }}>
                  {t('customerUtang.installmentOffer')}
                </p>
                <p className="text-base font-black text-slate-900 mt-0.5" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                  {t('customerUtang.reviewBeforeAccept')}
                </p>
              </div>
              {offerAcceptStatus !== 'signing' && !isCreating && (
                <button
                  onClick={() => setUploadedOffer(null)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-95"
                  style={{ backgroundColor: '#F1F5F9' }}
                >
                  <X size={16} style={{ color: '#64748B' }} />
                </button>
              )}
            </div>

            <div className="px-5 pb-6 space-y-4">
              {/* Details card */}
              <div className="rounded-2xl overflow-hidden" style={{ border: '1.5px solid #F1F5F9' }}>
                {uploadedOffer.d && (
                  <div className="px-4 py-3" style={{ borderBottom: '1px solid #F8FAFC' }}>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{t('utang.items')}</p>
                    <p className="text-sm font-bold text-slate-800">{uploadedOffer.d}</p>
                  </div>
                )}
                <div className="grid grid-cols-3 divide-x divide-slate-100">
                  <div className="p-4 text-center">
                    <p className="text-xl font-black text-slate-900 leading-tight" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                      {(uploadedOffer.a / STROOPS).toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">XLM {t('customerUtang.total')}</p>
                  </div>
                  <div className="p-4 text-center">
                    <p className="text-xl font-black text-slate-900 leading-tight" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                      {uploadedOffer.n}×
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{(uploadedOffer.a / STROOPS / uploadedOffer.n).toFixed(2)} XLM</p>
                  </div>
                  <div className="p-4 text-center">
                    <p className="text-base font-black text-slate-900 leading-tight capitalize" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                      {intervalLabel(uploadedOffer.i, t)}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{t('customerUtang.interval')}</p>
                  </div>
                </div>
                <div className="px-4 py-2.5" style={{ backgroundColor: '#FAFAFA', borderTop: '1px solid #F8FAFC' }}>
                  <p className="text-xs text-slate-400 font-mono truncate">
                    {t('customerUtang.vendor')}: {uploadedOffer.v.slice(0, 12)}…{uploadedOffer.v.slice(-6)}
                  </p>
                </div>
              </div>

              {offerAcceptStatus === 'idle' && (
                <button
                  onClick={handleAcceptOffer}
                  className="w-full text-white font-black rounded-2xl active:scale-95 transition-all"
                  style={{
                    backgroundColor: '#008055',
                    minHeight: '56px',
                    fontSize: '1rem',
                    fontFamily: "'Montserrat', sans-serif",
                    boxShadow: '0 6px 20px rgba(15,118,110,0.35)',
                  }}
                >
                  {t('customerUtang.acceptAndSign')}
                </button>
              )}
              {(offerAcceptStatus === 'signing' || isCreating) && (
                <div className="text-center py-5 space-y-2 rounded-2xl" style={{ backgroundColor: '#F8FAFC' }}>
                  <Loader2 className="animate-spin mx-auto" size={26} style={{ color: '#008055' }} />
                  <p className="text-sm font-bold text-slate-600">{t('customerUtang.confirmInWallet')}</p>
                  <p className="text-xs text-slate-400">{t('customerUtang.confirmWalletHint')}</p>
                </div>
              )}
              {offerAcceptStatus === 'confirmed' && (
                <div className="space-y-3">
                  <div
                    className="flex items-center gap-3 p-4 rounded-2xl"
                    style={{ backgroundColor: '#F0FDF4', border: '1.5px solid #BBF7D0' }}
                  >
                    <CheckCircle size={20} style={{ color: '#16A34A' }} />
                    <p className="text-sm font-bold text-green-800">{t('customerUtang.agreementAccepted')}</p>
                  </div>
                  {offerTxHash && (
                    <a
                      href={stellarExpertUrl(offerTxHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 text-xs font-bold py-3 rounded-xl w-full"
                      style={{ color: '#008055', backgroundColor: '#F0FDFA' }}
                    >
                      <ExternalLink size={12} /> {t('customerUtang.viewOnExpert')}
                    </a>
                  )}
                  <button
                    onClick={() => setUploadedOffer(null)}
                    className="w-full font-bold rounded-2xl active:scale-95 text-sm"
                    style={{ minHeight: '52px', border: '2px solid #E2E8F0', color: '#475569' }}
                  >
                    {t('customerUtang.close')}
                  </button>
                </div>
              )}
              {offerAcceptStatus === 'failed' && (
                <div className="space-y-3">
                  <div
                    className="flex items-center gap-3 p-4 rounded-2xl"
                    style={{ backgroundColor: '#FFF1F2', border: '1.5px solid #FECDD3' }}
                  >
                    <AlertTriangle size={18} style={{ color: '#F43F5E' }} />
                    <p className="text-sm font-semibold text-rose-700 flex-1">{offerError}</p>
                  </div>
                  <button
                    onClick={handleAcceptOffer}
                    className="w-full text-white font-bold rounded-2xl active:scale-95"
                    style={{ backgroundColor: '#008055', minHeight: '52px' }}
                  >
                    {t('customerUtang.tryAgain')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Resume after late bottom sheet ── */}
      {resuming && createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full rounded-t-3xl overflow-hidden" style={{ backgroundColor: 'white', maxWidth: '480px' }}>
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: '#E2E8F0' }} />
            </div>
            <div className="px-5 pt-2 pb-2 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#D97706' }}>Resume Defaulted Utang</p>
                <p className="text-base font-black text-slate-900 mt-0.5" style={{ fontFamily: "'Montserrat', sans-serif" }}>I-restore ang plan</p>
              </div>
              {!isResuming && (
                <button
                  onClick={() => setResuming(null)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-95"
                  style={{ backgroundColor: '#F1F5F9' }}
                >
                  <X size={16} style={{ color: '#64748B' }} />
                </button>
              )}
            </div>
            <div className="px-5 pb-8 space-y-4">
              {resuming.description && (
                <p className="text-sm font-semibold px-4 py-3 rounded-2xl" style={{ backgroundColor: '#F8FAFC', color: '#475569' }}>
                  {resuming.description}
                </p>
              )}
              <div className="rounded-2xl p-5 text-center" style={{ background: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)' }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  5% Late Fee
                </p>
                <p className="font-black text-white leading-none" style={{ fontSize: '2.6rem', fontFamily: "'Montserrat', sans-serif", letterSpacing: '-0.02em' }}>
                  {(resuming.installmentAmountXlm * 0.05).toFixed(2)}
                </p>
                <p className="text-base font-bold mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>XLM</p>
                <p className="text-xs mt-3" style={{ color: 'rgba(255,255,255,0.85)' }}>
                  Babayaran direkta sa vendor. Status mag-aaktibo ulit.
                </p>
              </div>
              <div className="rounded-2xl px-4 py-3 flex items-start gap-2" style={{ backgroundColor: '#FFF7ED', border: '1px solid #FED7AA' }}>
                <AlertTriangle size={12} style={{ color: '#C2410C' }} className="mt-0.5 shrink-0" />
                <p className="text-[11px]" style={{ color: '#9A3412' }}>
                  Pagkatapos ng resume, balik aktibo ang utang at kailangang bayaran ang natitirang {resuming.installmentsTotal - resuming.installmentsPaid} installment(s).
                </p>
              </div>
              {!isResuming && !resumeTxHash && !resumeError && (
                <button
                  onClick={confirmResume}
                  className="w-full text-white font-black rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#D97706', minHeight: '56px', fontSize: '1rem', fontFamily: "'Montserrat', sans-serif", boxShadow: '0 6px 20px rgba(217,119,6,0.35)' }}
                >
                  <RotateCcw size={16} /> Bayaran ang Late Fee at I-resume
                </button>
              )}
              {isResuming && (
                <div className="text-center py-5 space-y-2 rounded-2xl" style={{ backgroundColor: '#F8FAFC' }}>
                  <Loader2 className="animate-spin mx-auto" size={26} style={{ color: '#D97706' }} />
                  <p className="text-sm font-bold text-slate-600">Pinoproseso…</p>
                </div>
              )}
              {resumeTxHash && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ backgroundColor: '#F0FDF4', border: '1.5px solid #BBF7D0' }}>
                    <CheckCircle size={20} style={{ color: '#16A34A' }} />
                    <p className="text-sm font-bold text-green-800">Utang resumed!</p>
                  </div>
                  <a
                    href={stellarExpertUrl(resumeTxHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 text-xs font-bold py-3 rounded-xl w-full"
                    style={{ color: '#008055', backgroundColor: '#F0FDFA' }}
                  >
                    <ExternalLink size={12} /> Tingnan sa Stellar Expert
                  </a>
                  <button
                    onClick={() => setResuming(null)}
                    className="w-full font-bold rounded-2xl active:scale-95 text-sm"
                    style={{ minHeight: '52px', border: '2px solid #E2E8F0', color: '#475569' }}
                  >
                    Isara
                  </button>
                </div>
              )}
              {resumeError && !resumeTxHash && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ backgroundColor: '#FFF1F2', border: '1.5px solid #FECDD3' }}>
                    <AlertTriangle size={18} style={{ color: '#F43F5E' }} />
                    <p className="text-sm font-semibold text-rose-700 flex-1">{resumeError}</p>
                  </div>
                  <button
                    onClick={confirmResume}
                    className="w-full text-white font-bold rounded-2xl active:scale-95"
                    style={{ backgroundColor: '#D97706', minHeight: '52px' }}
                  >
                    Subukan Ulit
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Pay installment bottom sheet ── */}
      {paying && createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div
            className="w-full rounded-t-3xl overflow-hidden"
            style={{ backgroundColor: 'white', maxWidth: '480px' }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: '#E2E8F0' }} />
            </div>

            <div className="px-5 pt-2 pb-2 flex items-center justify-between">
              <p className="text-base font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                {t('customerUtang.payInstallment')}
              </p>
              {status !== 'building' && status !== 'signing' && status !== 'submitting' && (
                <button
                  onClick={handleClosePayModal}
                  className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-95"
                  style={{ backgroundColor: '#F1F5F9' }}
                >
                  <X size={16} style={{ color: '#64748B' }} />
                </button>
              )}
            </div>

            <div className="px-5 pb-8 space-y-4">
              {/* Description */}
              {paying.description && (
                <p
                  className="text-sm font-semibold px-4 py-3 rounded-2xl"
                  style={{ backgroundColor: '#F8FAFC', color: '#475569' }}
                >
                  {paying.description}
                </p>
              )}

              {/* Amount hero */}
              <div
                className="rounded-2xl p-5 text-center"
                style={{ backgroundColor: '#00284B' }}
              >
                <p
                  className="text-xs font-bold uppercase tracking-widest mb-2"
                  style={{ color: 'rgba(255,255,255,0.4)' }}
                >
                  {t('customerUtang.installmentNumber', { current: paying.installmentsPaid + 1, total: paying.installmentsTotal })}
                </p>
                <p
                  className="font-black text-white leading-none"
                  style={{ fontSize: '2.6rem', fontFamily: "'Montserrat', sans-serif", letterSpacing: '-0.02em' }}
                >
                  {(() => {
                    const remaining = paying.installmentsTotal - paying.installmentsPaid;
                    const rest = paying.totalAmountXlm - paying.installmentAmountXlm * paying.installmentsPaid;
                    return (remaining === 1 ? rest : paying.installmentAmountXlm).toFixed(2);
                  })()}
                </p>
                <p className="text-base font-bold mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>XLM</p>
              </div>

              {status === 'idle' && (
                <button
                  onClick={confirmPay}
                  className="w-full text-white font-black rounded-2xl active:scale-95 transition-all"
                  style={{
                    backgroundColor: '#008055',
                    minHeight: '56px',
                    fontSize: '1rem',
                    fontFamily: "'Montserrat', sans-serif",
                    boxShadow: '0 6px 20px rgba(15,118,110,0.35)',
                  }}
                >
                  {t('customerUtang.confirmPayment')}
                </button>
              )}
              {(status === 'building' || status === 'signing' || status === 'submitting') && (
                <div className="text-center py-5 space-y-2 rounded-2xl" style={{ backgroundColor: '#F8FAFC' }}>
                  <Loader2 className="animate-spin mx-auto" size={26} style={{ color: '#008055' }} />
                  <p className="text-sm font-bold text-slate-600">
                    {status === 'building' ? t('customerUtang.preparing') : status === 'signing' ? t('customerUtang.confirmInWallet') : t('customerUtang.processing')}
                  </p>
                </div>
              )}
              {status === 'confirmed' && (
                <div className="space-y-3">
                  <div
                    className="flex items-center gap-3 p-4 rounded-2xl"
                    style={{ backgroundColor: '#F0FDF4', border: '1.5px solid #BBF7D0' }}
                  >
                    <CheckCircle size={20} style={{ color: '#16A34A' }} />
                    <p className="text-sm font-bold text-green-800">{t('customerUtang.paymentComplete')}</p>
                  </div>
                  {txHash && (
                    <a
                      href={stellarExpertUrl(txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 text-xs font-bold py-3 rounded-xl w-full"
                      style={{ color: '#008055', backgroundColor: '#F0FDFA' }}
                    >
                      <ExternalLink size={12} /> {t('customerUtang.viewOnExpert')}
                    </a>
                  )}
                  {txHash && paying && paying.installmentsPaid + 1 >= paying.installmentsTotal && (
                    <RatingPrompt
                      vendorAddress={paying.vendorWallet}
                      vendorName={truncateAddress(paying.vendorWallet)}
                      paymentTxHash={txHash}
                    />
                  )}
                  <button
                    onClick={handleClosePayModal}
                    className="w-full font-bold rounded-2xl active:scale-95 text-sm"
                    style={{ minHeight: '52px', border: '2px solid #E2E8F0', color: '#475569' }}
                  >
                    {t('customerUtang.close')}
                  </button>
                </div>
              )}
              {status === 'failed' && (
                <div className="space-y-3">
                  <div
                    className="flex items-center gap-3 p-4 rounded-2xl"
                    style={{ backgroundColor: '#FFF1F2', border: '1.5px solid #FECDD3' }}
                  >
                    <AlertTriangle size={18} style={{ color: '#F43F5E' }} />
                    <p className="text-sm font-semibold text-rose-700 flex-1">{error}</p>
                  </div>
                  <button
                    onClick={confirmPay}
                    className="w-full text-white font-bold rounded-2xl active:scale-95"
                    style={{ backgroundColor: '#008055', minHeight: '52px' }}
                  >
                    {t('customerUtang.tryAgain')}
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