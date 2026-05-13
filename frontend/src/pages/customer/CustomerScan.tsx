import { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, Loader2, X, ExternalLink, AlertTriangle, Store, RotateCcw, ScanLine, Home, List, HandCoins, Store as StoreIcon } from 'lucide-react';
import { useNavigate, NavLink } from 'react-router-dom';
import { QRScanner } from '../../components/QRScanner';
import type { QRScanMeta } from '../../components/QRScanner';
import { PaymentForm } from '../../components/PaymentForm';
import { TxStatusTracker } from '../../components/TxStatusTracker';
import { useWallet } from '../../lib/hooks/useWallet';
import { useVendor } from '../../lib/hooks/useVendor';
import { usePayment } from '../../lib/hooks/usePayment';
import { useCreateUtang } from '../../lib/hooks/useUtang';
import type { UtangOfferPayload } from '../vendor/VendorUtang';
import { stellarExpertUrl, truncateAddress } from '../../lib/stellar';
import { formatPhp, formatXlm, type StableCheckoutQuote } from '../../lib/checkout-quote';

const STROOPS = 10_000_000;

const INTERVAL_LABELS: Record<number, string> = {
  604800: 'weekly',
  1209600: 'biweekly',
  2592000: 'monthly',
};
function intervalLabel(secs: number) {
  return INTERVAL_LABELS[secs] ?? `every ${Math.round(secs / 86400)}d`;
}

type Step = 'scan' | 'manual' | 'pay' | 'confirm' | 'done' | 'utang_offer' | 'utang_done';

interface PendingPayment {
  amount: string;
  memo: string;
  quote: StableCheckoutQuote;
}

export function CustomerScan() {
  const navigate = useNavigate();
  const { address, isConnected, connect } = useWallet();

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
  const { status, txHash, error, settlementMode, sendPayment, reset } = usePayment();
  const { createUtang, isCreating } = useCreateUtang();

  useEffect(() => {
    if (step === 'confirm' && status === 'confirmed') setStep('done');
  }, [step, status]);

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
      // Not an installment QR payload.
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

  const handleAcceptUtang = async () => {
    if (!utangOffer || !address) return;
    if (utangOffer.c && utangOffer.c !== address) {
      setUtangError('This installment offer is assigned to another customer wallet');
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
      setUtangError('Transaction failed — check wallet and try again');
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
    scan: 'Scan QR',
    manual: 'Enter Address',
    pay: 'Pay Vendor',
    confirm: 'Confirm Payment',
    done: 'Payment Sent!',
    utang_offer: 'Installment Offer',
    utang_done: 'Accepted!',
  };

  const vendorDisplay = vendor?.name ?? scannedMeta?.name ?? truncateAddress(vendorAddress);

  if (!isConnected) {
    return (
      <div
        className="min-h-[60vh] flex flex-col items-center justify-center px-6 animate-page-in"
        style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}
      >
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5"
          style={{ backgroundColor: '#F0FDFA', border: '2px solid #CCFBF1' }}
        >
          <ScanLine size={36} style={{ color: '#008055' }} />
        </div>
        <h2
          className="text-xl font-black text-slate-900 mb-2 text-center"
          style={{ fontFamily: "'Montserrat', sans-serif" }}
        >
          Connect your wallet
        </h2>
        <p className="text-sm text-slate-500 text-center mb-6">
          Kailangan ng wallet para mag-scan at magbayad.
        </p>
        <button
          onClick={connect}
          className="w-full text-white font-bold py-4 rounded-2xl active:scale-95 transition-all text-base"
          style={{ backgroundColor: '#008055', maxWidth: '320px' }}
        >
          I-connect ang Wallet
        </button>
      </div>
    );
  }

  return (
    <div
      className="animate-page-in"
      style={{ paddingBottom: step === 'scan' ? 0 : 'calc(80px + env(safe-area-inset-bottom))' }}
    >
      {/* ── Header ── */}
      {step !== 'scan' && (
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
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
      )}

      {/* ── Step: scan ── */}
      {step === 'scan' && (
        <div
          className="flex flex-col"
          style={{
            backgroundColor: '#00284B',
            minHeight: '100dvh',
          }}
        >
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
              top: -80, left: '50%', transform: 'translateX(-50%)',
              width: 320, height: 320, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(20,184,166,0.25) 0%, transparent 65%)',
              filter: 'blur(60px)',
            }}
          />

          {/* Header */}
          <div className="relative px-4 pt-4 pb-4 flex items-center gap-3 shrink-0">
            <button
              onClick={() => navigate('/customer/home')}
              className="w-10 h-10 rounded-2xl flex items-center justify-center active:scale-95 shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
            >
              <ArrowLeft size={18} style={{ color: 'rgba(255,255,255,0.8)' }} />
            </button>
            <div>
              <h1 className="text-base font-black text-white leading-tight" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                I-Scan ang QR
              </h1>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Payment QR at utang offer — auto-detect
              </p>
            </div>
          </div>

          {/* Scanner */}
          <div className="relative flex-1">
            <QRScanner
              onScan={handlePaymentScan}
              onRawScan={handleRawScan}
              onManualEntry={() => setStep('manual')}
            />
          </div>

          {/* Bottom nav */}
          <nav
            className="shrink-0 bg-white border-t border-slate-200"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex h-16 items-center">
              {[
                { to: '/customer/home', icon: Home, label: 'Home' },
                { to: '/customer/history', icon: List, label: 'History' },
                { to: '/customer/scan', icon: ScanLine, label: 'Scan', center: true },
                { to: '/customer/utang', icon: HandCoins, label: 'Utang' },
                { to: '/market', icon: StoreIcon, label: 'Market' },
              ].map(({ to, icon: Icon, label, center }) => {
                if (center) {
                  return (
                    <div key={to} className="flex-1 flex flex-col items-center justify-center overflow-visible">
                      <div className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg -translate-y-5 border-4 border-white bg-teal-600">
                        <Icon size={22} className="text-white" />
                      </div>
                      <span className="text-xs font-medium -mt-3.5 text-teal-700">{label}</span>
                    </div>
                  );
                }
                return (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-w-0 ${isActive ? 'text-teal-700' : 'text-slate-400'}`
                    }
                  >
                    <Icon size={18} />
                    <span className="text-xs font-medium leading-tight">{label}</span>
                  </NavLink>
                );
              })}
            </div>
          </nav>
        </div>
      )}

      {/* ── Step: manual address ── */}
      {step === 'manual' && (
        <form onSubmit={handleManualSubmit} className="px-4 pt-2 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wider">
              Vendor Wallet Address
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
              56-character Stellar address starting with G
            </p>
          </div>
          <button
            type="submit"
            className="w-full text-white font-bold rounded-2xl active:scale-95 transition-all"
            style={{ backgroundColor: '#008055', minHeight: '56px', fontSize: '1rem' }}
          >
            Ituloy
          </button>
        </form>
      )}

      {/* ── Step: payment form ── */}
      {step === 'pay' && (
        <div className="px-4 pt-2">
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
        </div>
      )}

      {/* ── Step: confirm ── */}
      {step === 'confirm' && pendingPayment && (
        <div className="px-4 pt-2 space-y-3">
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
                Nagbabayad kay
              </p>
              <p className="text-base font-black text-slate-900 truncate" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                {vendorDisplay}
              </p>
            </div>
          </div>

          {/* Amount — large and confident */}
          <div
            className="rounded-3xl p-6 text-center"
            style={{ backgroundColor: '#00284B' }}
          >
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Halagang Babayaran
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
                  Price lock
                </p>
                <p className="text-sm font-black text-white">
                  ₱{pendingPayment.quote.phpPerXlm.toFixed(2)}/XLM
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Expires
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
              ? 'On-chain receipt — recorded by PalengkePayment'
              : 'Gasless — fees sponsored, zero cost sa iyo'}
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
              Kumpirmahin at I-sign
            </button>
          )}

          {status !== 'idle' && status !== 'confirmed' && (
            <TxStatusTracker
              status={status}
              txHash={txHash}
              error={error}
              amount={pendingPayment.amount}
              recipientName={vendorDisplay}
              onRetry={() => { reset(); }}
            />
          )}
        </div>
      )}

      {/* ── Step: payment done ── */}
      {step === 'done' && (
        <div className="px-4 pt-2">
          <div
            className="rounded-3xl overflow-hidden"
            style={{ border: '1.5px solid #F1F5F9' }}
          >
            {/* Green success header */}
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
                Bayad na!
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
                  kay {vendorDisplay}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="bg-white p-5 space-y-3">
              {pendingPayment && (
                <div
                  className="rounded-2xl p-4"
                  style={{ backgroundColor: '#F8FAFC', border: '1.5px solid #E2E8F0' }}
                >
                  <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                    Dual-currency receipt
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-slate-400">Customer paid</p>
                      <p className="text-sm font-black text-slate-900">{formatPhp(pendingPayment.quote.phpAmount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Settled on Stellar</p>
                      <p className="text-sm font-black text-slate-900">{formatXlm(pendingPayment.quote.xlmAmount)}</p>
                    </div>
                  </div>
                </div>
              )}
              {txHash && (
                <a
                  href={stellarExpertUrl(txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 text-xs font-bold py-3 rounded-xl w-full transition-colors active:scale-95"
                  style={{ color: '#008055', backgroundColor: '#F0FDFA' }}
                >
                  <ExternalLink size={13} /> Tingnan sa Stellar Expert
                </a>
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
                  <RotateCcw size={14} /> Bayad Ulit
                </button>
                <button
                  onClick={() => navigate('/customer/home')}
                  className="font-bold rounded-2xl active:scale-95 transition-all text-sm text-white"
                  style={{ minHeight: '52px', backgroundColor: '#008055' }}
                >
                  Home
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Step: utang offer ── */}
      {step === 'utang_offer' && utangOffer && (
        <div className="px-4 pt-2 space-y-3">
          {/* Offer header */}
          <div
            className="rounded-2xl p-4 flex items-center justify-between"
            style={{ backgroundColor: '#FFFBEB', border: '2px solid #FDE68A' }}
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#D97706' }}>
                Installment Credit Offer
              </p>
              <p className="text-sm font-black text-slate-800 mt-0.5" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                Suriin bago tanggapin
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

          {/* Offer details */}
          <div
            className="rounded-3xl overflow-hidden"
            style={{ border: '1.5px solid #F1F5F9' }}
          >
            {utangOffer.d && (
              <div className="px-5 py-4" style={{ borderBottom: '1px solid #F8FAFC' }}>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Mga Biniling Item</p>
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
                  {intervalLabel(utangOffer.i)}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">interval</p>
              </div>
            </div>

            <div className="px-5 py-3" style={{ borderTop: '1px solid #F8FAFC', backgroundColor: '#FAFAFA' }}>
              <p className="text-xs text-slate-400 font-mono truncate">
                Vendor: {utangOffer.v.slice(0, 12)}…{utangOffer.v.slice(-6)}
              </p>
            </div>
          </div>

          {utangAcceptStatus === 'idle' && (
            <button
              onClick={handleAcceptUtang}
              className="w-full text-white font-black rounded-2xl active:scale-95 transition-all"
              style={{
                backgroundColor: '#008055',
                minHeight: '60px',
                fontSize: '1.05rem',
                fontFamily: "'Montserrat', sans-serif",
                boxShadow: '0 6px 24px rgba(15,118,110,0.4)',
              }}
            >
              Tanggapin at I-sign
            </button>
          )}

          {(utangAcceptStatus === 'signing' || isCreating) && (
            <div
              className="text-center py-6 space-y-3 rounded-2xl"
              style={{ backgroundColor: '#F8FAFC' }}
            >
              <Loader2 className="animate-spin mx-auto" size={28} style={{ color: '#008055' }} />
              <p className="text-sm font-bold text-slate-600">Kumpirmahin sa iyong wallet…</p>
              <p className="text-xs text-slate-400">Sa mobile: buksan ang LOBSTR app at i-approve.</p>
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
                Subukan Ulit
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Step: utang done ── */}
      {step === 'utang_done' && (
        <div className="px-4 pt-2">
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
                Kasunduan Tinanggap!
              </h2>
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Aktibo na ang installment plan.
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
                  <ExternalLink size={13} /> Tingnan sa Stellar Expert
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
                  Tingnan Utang
                </button>
                <button
                  onClick={() => navigate('/customer/home')}
                  className="font-bold rounded-2xl active:scale-95 text-sm text-white"
                  style={{ minHeight: '52px', backgroundColor: '#008055' }}
                >
                  Home
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
