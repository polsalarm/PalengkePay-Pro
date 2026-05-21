import { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, Loader2, X, ExternalLink, AlertTriangle, Store, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { QRScanner } from '../../components/QRScanner';
import type { QRScanMeta } from '../../components/QRScanner';
import { PaymentForm } from '../../components/PaymentForm';
import { TxStatusTracker } from '../../components/TxStatusTracker';
import { WalletRequiredState } from '../../components/WalletRequiredState';
import { useWallet } from '../../lib/hooks/useWallet';
import { useVendor } from '../../lib/hooks/useVendor';
import { usePayment } from '../../lib/hooks/usePayment';
import { useCreateUtang } from '../../lib/hooks/useUtang';
import type { UtangOfferPayload } from '../vendor/VendorUtang';
import { stellarExpertAccountUrl, stellarExpertUrl, truncateAddress } from '../../lib/stellar';
import { formatPhp, formatXlm, type StableCheckoutQuote } from '../../lib/checkout-quote';
import { ESCROW_CONTRACT_ID } from '../../lib/contracts';
import { savePaymentProof } from '../../lib/payment-proof';
import { useLanguage } from '../../contexts/LanguageContext';

const STROOPS = 10_000_000;

const INTERVAL_LABELS: Record<number, { en: string; tl: string }> = {
  604800: { en: 'weekly', tl: 'lingguhan' },
  1209600: { en: 'biweekly', tl: 'bawat dalawang linggo' },
  2592000: { en: 'monthly', tl: 'buwanan' },
};
function intervalLabel(secs: number, t: (key: string, params?: any) => string) {
  const label = INTERVAL_LABELS[secs];
  if (label) return t(`scan.interval.${label.en}`);
  return t('scan.interval.every', { days: Math.round(secs / 86400) });
}

type Step = 'scan' | 'manual' | 'pay' | 'confirm' | 'done' | 'utang_offer' | 'utang_done';

interface PendingPayment {
  amount: string;
  memo: string;
  quote: StableCheckoutQuote;
}

export function CustomerScan() {
  const navigate = useNavigate();
  const { address } = useWallet();
  const { t } = useLanguage();

  const [step, setStep] = useState<Step>('scan');
  const [vendorAddress, setVendorAddress] = useState('');
  const [scannedMeta, setScannedMeta] = useState<QRScanMeta | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);
  const [utangOffer, setUtangOffer] = useState<UtangOfferPayload | null>(null);
  const [utangTxHash, setUtangTxHash] = useState<string | null>(null);
  const [utangAcceptStatus, setUtangAcceptStatus] = useState<'idle' | 'signing' | 'confirmed' | 'failed'>('idle');
  const [utangError, setUtangError] = useState<string | null>(null);

  const { vendor, isLoading: vendorLoading } = useVendor(
    step === 'pay' || step === 'confirm' || step === 'done' ? vendorAddress : null
  );
  const { status, txHash, error, diagnostic, settlementMode, sendPayment, reset } = usePayment();
  const { createUtang, isCreating } = useCreateUtang();

  useEffect(() => {
    if (step === 'confirm' && status === 'confirmed') setStep('done');
  }, [step, status]);

  useEffect(() => {
    if (status !== 'confirmed' || !txHash || !address || !pendingPayment) return;

    savePaymentProof({
      txHash,
      from: address,
      to: vendorAddress,
      amountXlm: Number(pendingPayment.amount),
      memo: pendingPayment.memo,
      createdAt: new Date().toISOString(),
      settlementMode,
      quote: pendingPayment.quote,
    });
  }, [address, pendingPayment, settlementMode, status, txHash, vendorAddress]);

  const handleRawScan = (raw: string): boolean => {
    try {
      const parsed = JSON.parse(raw) as UtangOfferPayload;
      if (parsed.t === 'u' && parsed.v && parsed.a && parsed.n && parsed.i) {
        setUtangOffer(parsed);
        setUtangAcceptStatus('idle');
        setUtangTxHash(null);
        setUtangError(null);
        setStep('utang_offer');
        return true;
      }
    } catch (parseError) {
      void parseError;
    }
    return false;
  };

  const handlePaymentScan = (addr: string, meta?: QRScanMeta) => {
    setVendorAddress(addr);
    setScannedMeta(meta ?? null);
    setStep('pay');
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const addr = manualInput.trim();
    if (addr.startsWith('G') && addr.length === 56) {
      setVendorAddress(addr);
      setScannedMeta(null);
      setStep('pay');
    }
  };

  const handlePay = (amount: string, memo: string, quote: StableCheckoutQuote) => {
    setPendingPayment({ amount, memo, quote });
    reset();
    setStep('confirm');
  };

  const handleConfirm = async () => {
    if (!address || !pendingPayment) return;
    await sendPayment(address, vendorAddress, pendingPayment.amount, pendingPayment.memo);
  };

  const handleRetryPayment = () => {
    void handleConfirm();
  };

  const handleEditPayment = () => {
    reset();
    setStep('pay');
  };

  const handleAcceptUtang = async () => {
    if (!utangOffer || !address) return;
    if (utangOffer.c && utangOffer.c !== address) {
      setUtangError(t('scan.utangWrongWallet'));
      setUtangAcceptStatus('failed');
      return;
    }
    setUtangAcceptStatus('signing');
    setUtangError(null);
    const hash = await createUtang(
      {
        vendorWallet: utangOffer.v,
        customerWallet: address,
        totalAmountXlm: utangOffer.a / STROOPS,
        installmentsTotal: utangOffer.n,
        intervalDays: Math.round(utangOffer.i / 86400),
        description: utangOffer.d ?? '',
      },
      address
    );
    if (hash) {
      setUtangTxHash(hash);
      setUtangAcceptStatus('confirmed');
      setStep('utang_done');
    } else {
      setUtangError(t('scan.utangFailed'));
      setUtangAcceptStatus('failed');
    }
  };

  const backToScan = () => {
    setStep('scan');
    setUtangOffer(null);
    setUtangAcceptStatus('idle');
    setPendingPayment(null);
    reset();
  };

  const stepTitle: Record<Step, string> = {
    scan: t('scan.title'),
    manual: t('scan.manualTitle'),
    pay: t('scan.payTitle'),
    confirm: t('scan.confirmTitle'),
    done: t('scan.doneTitle'),
    utang_offer: t('scan.utangOfferTitle'),
    utang_done: t('scan.utangDoneTitle'),
  };

  const vendorDisplay = vendor?.name ?? scannedMeta?.name ?? truncateAddress(vendorAddress);

  if (!address) {
    return (
      <WalletRequiredState
        detail={t('scan.walletRequiredDetail')}
        fullScreen
        tone="dark"
      />
    );
  }

  // For scan mode - full blue background with centered content
  if (step === 'scan') {
    return (
      <div
        className="min-h-screen"
        style={{
          backgroundColor: '#00284B',
          marginTop: '-24px',
          marginBottom: '-24px',
          marginLeft: '-32px',
          marginRight: '-32px',
          width: 'calc(100% + 64px)',
        }}
      >
        {/* Background texture */}
        <div
          className="fixed inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage: `repeating-linear-gradient(
              45deg,
              white 0px,
              white 1px,
              transparent 1px,
              transparent 12px
            ),
            repeating-linear-gradient(
              -45deg,
              white 0px,
              white 1px,
              transparent 1px,
              transparent 12px
            )`,
          }}
        />

        {/* Glow */}
        <div
          className="fixed pointer-events-none"
          style={{
            top: -100,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 400,
            height: 400,
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(20,184,166,0.2) 0%, transparent 65%)',
            filter: 'blur(60px)',
          }}
        />

        {/* CONTENT WRAPPER - centered with side margins */}
        <div className="relative max-w-md mx-auto px-5 flex flex-col min-h-screen">
          
          {/* Header */}
          <div className="pt-8 pb-4">
            <p
              className="text-xs font-bold uppercase tracking-widest text-center"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              {t('scan.scanHeader')}
            </p>

            <h1
              className="text-xl font-black text-white text-center mt-1"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              {t('scan.title')}
            </h1>

            <p
              className="text-sm text-center mt-1"
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
              {t('scan.scanSub')}
            </p>
          </div>

          {/* Scanner */}
          <div className="flex-1 flex items-center justify-center py-4">
            <div className="w-full">
              <QRScanner
                onScan={handlePaymentScan}
                onRawScan={handleRawScan}
                onManualEntry={() => setStep('manual')}
              />
            </div>
          </div>

          {/* Bottom */}
          <div
            className="pb-6 text-center"
            style={{
              paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
            }}
          >
            <p
              className="text-xs"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              {t('scan.bottomHint')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // For other steps - normal content with max-width
  return (
    <div className="max-w-md mx-auto space-y-4 pb-8">
      {/* Back button */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={() => {
            if (step === 'done' || step === 'utang_done') navigate('/customer/home');
            else backToScan();
          }}
          className="w-10 h-10 rounded-2xl flex items-center justify-center transition-colors active:scale-95"
          style={{ backgroundColor: '#F1F5F9' }}
        >
          <ArrowLeft size={18} style={{ color: '#475569' }} />
        </button>
        <h1
          className="text-lg font-black text-slate-900"
          style={{ fontFamily: "'Montserrat', sans-serif" }}
        >
          {stepTitle[step]}
        </h1>
      </div>

      {/* Manual Entry Form */}
      {step === 'manual' && (
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wider">
              {t('scan.vendorAddressLabel')}
            </label>
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="G..."
              className="w-full rounded-2xl px-4 font-mono text-sm focus:outline-none focus:ring-2"
              style={{
                border: '2px solid #E2E8F0',
                padding: '14px 16px',
                fontSize: '0.875rem',
              }}
              autoFocus
            />
            <p className="text-xs text-slate-400 mt-1.5 px-1">
              {t('scan.vendorAddressHint')}
            </p>
          </div>
          <button
            type="submit"
            className="w-full text-white font-bold rounded-2xl active:scale-95 transition-all"
            style={{ backgroundColor: '#008055', minHeight: '56px', fontSize: '1rem' }}
          >
            {t('scan.continue')}
          </button>
        </form>
      )}

      {/* Payment Form */}
      {step === 'pay' && (
        <PaymentForm
          vendorAddress={vendorAddress}
          vendor={vendor}
          isLoading={vendorLoading}
          preloadedVendorName={scannedMeta?.name}
          preloadedStallInfo={scannedMeta?.stallInfo}
          onSubmit={handlePay}
          disabled={false}
          settlementMode={settlementMode}
        />
      )}

      {/* Confirm Payment */}
      {step === 'confirm' && pendingPayment && (
        <div className="space-y-3">
          {/* Vendor card */}
          <div
            className="rounded-2xl p-4 flex items-center gap-3"
            style={{ backgroundColor: '#F0FDFA', border: '2px solid #CCFBF1' }}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: '#008055' }}
            >
              <Store size={20} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: '#008055' }}>
                {t('scan.payingTo')}
              </p>
              <p className="text-base font-black text-slate-900 truncate" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                {vendorDisplay}
              </p>
            </div>
          </div>

          {/* Amount */}
          <div
            className="rounded-3xl p-6 text-center"
            style={{ backgroundColor: '#00284B' }}
          >
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {t('scan.amountToPay')}
            </p>
            <p
              className="font-black text-white leading-none mb-1"
              style={{
                fontSize: formatPhp(pendingPayment.quote.phpAmount).length > 10 ? '2.1rem' : '3rem',
                fontFamily: "'Montserrat', sans-serif",
                letterSpacing: '-0.02em',
              }}
            >
              {formatPhp(pendingPayment.quote.phpAmount)}
            </p>
            <p className="text-base font-bold" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {formatXlm(pendingPayment.quote.xlmAmount)}
            </p>
            <div
              className="mt-4 pt-4 grid grid-cols-2 gap-3 text-left"
              style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
            >
              <div>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {t('scan.priceLock')}
                </p>
                <p className="text-sm font-black text-white">
                  ₱{pendingPayment.quote.phpPerXlm.toFixed(2)}/XLM
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {t('scan.expires')}
                </p>
                <p className="text-sm font-black text-white">
                  {new Date(pendingPayment.quote.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
            {pendingPayment.memo && (
              <div
                className="mt-4 pt-4 text-sm font-semibold"
                style={{ borderTop: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}
              >
                "{pendingPayment.memo}"
              </div>
            )}
          </div>

          {/* Settlement badge */}
          <div
            className="flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold"
            style={{ backgroundColor: '#F0FDF4', color: '#16A34A' }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#22C55E' }} />
            {settlementMode === 'contract'
              ? t('scan.onChainReceipt')
              : t('scan.gasless')}
          </div>

          {status === 'idle' && (
            <button
              onClick={handleConfirm}
              className="w-full text-white font-black rounded-2xl active:scale-95 transition-all"
              style={{
                backgroundColor: '#008055',
                minHeight: '60px',
                fontSize: '1.05rem',
                fontFamily: "'Montserrat', sans-serif",
                boxShadow: '0 6px 24px rgba(15,118,110,0.4)',
              }}
            >
              {t('scan.confirmAndSign')}
            </button>
          )}

          {status !== 'idle' && status !== 'confirmed' && (
            <TxStatusTracker
              status={status}
              txHash={txHash}
              error={error}
              diagnostic={diagnostic}
              amount={pendingPayment.amount}
              recipientName={vendorDisplay}
              receiptLookupUrl={stellarExpertAccountUrl(address)}
              onRetry={handleRetryPayment}
              onEdit={handleEditPayment}
              onScanAgain={backToScan}
            />
          )}
        </div>
      )}

      {/* Payment Done */}
      {step === 'done' && (
        <div
          className="rounded-3xl overflow-hidden"
          style={{ border: '1.5px solid #F1F5F9' }}
        >
          <div
            className="p-8 text-center"
            style={{ background: 'linear-gradient(135deg, #00284B 0%, #008055 100%)' }}
          >
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
            >
              <CheckCircle size={40} className="text-white" />
            </div>
            <h2
              className="text-xl font-black text-white mb-1"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              {t('scan.paymentComplete')}
            </h2>
            {pendingPayment && (
              <p
                className="font-black text-white leading-none mt-3"
                style={{
                  fontSize: formatPhp(pendingPayment.quote.phpAmount).length > 10 ? '2rem' : '2.5rem',
                  fontFamily: "'Montserrat', sans-serif",
                  letterSpacing: '-0.02em',
                }}
              >
                {formatPhp(pendingPayment.quote.phpAmount)}
              </p>
            )}
            {pendingPayment && (
              <p className="text-sm mt-2 font-bold" style={{ color: 'rgba(255,255,255,0.55)' }}>
                {formatXlm(pendingPayment.quote.xlmAmount)} at ₱{pendingPayment.quote.phpPerXlm.toFixed(2)}/XLM
              </p>
            )}
            {vendorDisplay && (
              <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.55)' }}>
                {t('scan.toVendor', { name: vendorDisplay })}
              </p>
            )}
          </div>

          <div className="bg-white p-5 space-y-3">
            {pendingPayment && (
              <div
                className="rounded-2xl p-4"
                style={{ backgroundColor: '#F8FAFC', border: '1.5px solid #E2E8F0' }}
              >
                <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                  {t('scan.dualReceipt')}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-400">{t('scan.customerPaid')}</p>
                    <p className="text-sm font-black text-slate-900">{formatPhp(pendingPayment.quote.phpAmount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">{t('scan.settledOnStellar')}</p>
                    <p className="text-sm font-black text-slate-900">{formatXlm(pendingPayment.quote.xlmAmount)}</p>
                  </div>
                </div>
              </div>
            )}
            {txHash && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => navigate(`/receipt/${txHash}`)}
                  className="flex items-center justify-center gap-2 text-xs font-bold py-3 rounded-xl w-full transition-colors active:scale-95"
                  style={{ color: '#008055', backgroundColor: '#F0FDFA' }}
                >
                  {t('scan.digitalReceipt')}
                </button>
                <a
                  href={stellarExpertUrl(txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 text-xs font-bold py-3 rounded-xl w-full transition-colors active:scale-95"
                  style={{ color: '#008055', backgroundColor: '#F0FDFA' }}
                >
                  <ExternalLink size={13} /> {t('scan.stellarExpert')}
                </a>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={backToScan}
                className="flex items-center justify-center gap-2 font-bold rounded-2xl active:scale-95 transition-all text-sm"
                style={{
                  minHeight: '52px',
                  border: '2px solid #E2E8F0',
                  color: '#475569',
                  backgroundColor: 'white',
                }}
              >
                <RotateCcw size={14} /> {t('scan.payAgain')}
              </button>
              <button
                onClick={() => navigate('/customer/home')}
                className="font-bold rounded-2xl active:scale-95 transition-all text-sm text-white"
                style={{ minHeight: '52px', backgroundColor: '#008055' }}
              >
                {t('scan.home')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Utang Offer */}
      {step === 'utang_offer' && utangOffer && (
        <div className="space-y-3">
          <div
            className="rounded-2xl p-4 flex items-center justify-between"
            style={{ backgroundColor: '#FFFBEB', border: '2px solid #FDE68A' }}
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#D97706' }}>
                {t('scan.installmentOffer')}
              </p>
              <p className="text-sm font-black text-slate-800 mt-0.5" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                {t('scan.reviewBeforeAccept')}
              </p>
            </div>
            <button
              onClick={backToScan}
              className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-95"
              style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}
            >
              <X size={16} style={{ color: '#64748B' }} />
            </button>
          </div>

          <div
            className="rounded-3xl overflow-hidden"
            style={{ border: '1.5px solid #F1F5F9' }}
          >
            {utangOffer.d && (
              <div className="px-5 py-4" style={{ borderBottom: '1px solid #F8FAFC' }}>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{t('scan.itemsBought')}</p>
                <p className="text-base font-bold text-slate-800">{utangOffer.d}</p>
              </div>
            )}

            <div className="grid grid-cols-3 divide-x divide-slate-100">
              <div className="p-4 text-center">
                <p
                  className="text-xl font-black text-slate-900 leading-tight"
                  style={{ fontFamily: "'Montserrat', sans-serif" }}
                >
                  {(utangOffer.a / STROOPS).toFixed(2)}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">XLM total</p>
              </div>
              <div className="p-4 text-center">
                <p
                  className="text-xl font-black text-slate-900 leading-tight"
                  style={{ fontFamily: "'Montserrat', sans-serif" }}
                >
                  {utangOffer.n}×
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {(utangOffer.a / STROOPS / utangOffer.n).toFixed(2)} XLM
                </p>
              </div>
              <div className="p-4 text-center">
                <p
                  className="text-base font-black text-slate-900 leading-tight capitalize"
                  style={{ fontFamily: "'Montserrat', sans-serif" }}
                >
                  {intervalLabel(utangOffer.i, t)}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{t('scan.interval')}</p>
              </div>
            </div>

            <div className="px-5 py-3" style={{ borderTop: '1px solid #F8FAFC', backgroundColor: '#FAFAFA' }}>
              <p className="text-xs text-slate-400 font-mono truncate">
                {t('scan.vendor')}: {utangOffer.v.slice(0, 12)}…{utangOffer.v.slice(-6)}
              </p>
            </div>
          </div>

          {!ESCROW_CONTRACT_ID && (
            <div
              className="rounded-2xl p-4 flex gap-3"
              style={{ backgroundColor: '#FFFBEB', border: '1.5px solid #FDE68A' }}
            >
              <AlertTriangle size={18} className="shrink-0 mt-0.5" style={{ color: '#D97706' }} />
              <div>
                <p className="text-sm font-black text-slate-800">{t('scan.contractNotConfigured')}</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  {t('scan.contractHint')}
                </p>
              </div>
            </div>
          )}

          {utangAcceptStatus === 'idle' && (
            <button
              onClick={handleAcceptUtang}
              disabled={!ESCROW_CONTRACT_ID}
              className="w-full text-white font-black rounded-2xl active:scale-95 transition-all"
              style={{
                backgroundColor: ESCROW_CONTRACT_ID ? '#008055' : '#94A3B8',
                minHeight: '60px',
                fontSize: '1.05rem',
                fontFamily: "'Montserrat', sans-serif",
                boxShadow: '0 6px 24px rgba(15,118,110,0.4)',
              }}
            >
              {ESCROW_CONTRACT_ID ? t('scan.acceptAndSign') : t('scan.contractNotConfigured')}
            </button>
          )}

          {(utangAcceptStatus === 'signing' || isCreating) && (
            <div
              className="text-center py-6 space-y-3 rounded-2xl"
              style={{ backgroundColor: '#F8FAFC' }}
            >
              <Loader2 className="animate-spin mx-auto" size={28} style={{ color: '#008055' }} />
              <p className="text-sm font-bold text-slate-600">{t('scan.confirmInWallet')}</p>
              <p className="text-xs text-slate-400">{t('scan.confirmWalletHint')}</p>
            </div>
          )}

          {utangAcceptStatus === 'failed' && (
            <div className="space-y-3">
              <div
                className="flex items-center gap-3 p-4 rounded-2xl"
                style={{ backgroundColor: '#FFF1F2', border: '1.5px solid #FECDD3' }}
              >
                <AlertTriangle size={18} style={{ color: '#F43F5E' }} />
                <p className="text-sm font-semibold text-rose-700 flex-1">{utangError}</p>
              </div>
              <button
                onClick={handleAcceptUtang}
                className="w-full text-white font-bold rounded-2xl active:scale-95"
                style={{ backgroundColor: '#008055', minHeight: '56px' }}
              >
                {t('scan.tryAgain')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Utang Done */}
      {step === 'utang_done' && (
        <div
          className="rounded-3xl overflow-hidden"
          style={{ border: '1.5px solid #F1F5F9' }}
        >
          <div
            className="p-8 text-center"
            style={{ background: 'linear-gradient(135deg, #1C1917 0%, #D97706 100%)' }}
          >
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
            >
              <CheckCircle size={40} className="text-white" />
            </div>
            <h2
              className="text-xl font-black text-white mb-1"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              {t('scan.agreementAccepted')}
            </h2>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {t('scan.agreementActive')}
            </p>
          </div>

          <div className="bg-white p-5 space-y-3">
            {utangTxHash && (
              <a
                href={stellarExpertUrl(utangTxHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-xs font-bold py-3 rounded-xl w-full active:scale-95"
                style={{ color: '#008055', backgroundColor: '#F0FDFA' }}
              >
                <ExternalLink size={13} /> {t('scan.viewOnExpert')}
              </a>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => navigate('/customer/utang')}
                className="font-bold rounded-2xl active:scale-95 text-sm"
                style={{
                  minHeight: '52px',
                  border: '2px solid #E2E8F0',
                  color: '#475569',
                  backgroundColor: 'white',
                }}
              >
                {t('scan.viewUtang')}
              </button>
              <button
                onClick={() => navigate('/customer/home')}
                className="font-bold rounded-2xl active:scale-95 text-sm text-white"
                style={{ minHeight: '52px', backgroundColor: '#008055' }}
              >
                {t('scan.home')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}