import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HandCoins, CheckCircle, Loader2, X, ExternalLink, AlertTriangle, ScanLine, ImageUp } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { useWallet } from '../../lib/hooks/useWallet';
import { useCustomerUtangs, usePayInstallment, useCreateUtang } from '../../lib/hooks/useUtang';
import type { UtangRecord } from '../../lib/hooks/useUtang';
import type { UtangOfferPayload } from '../vendor/VendorUtang';
import { UtangCard } from '../../components/UtangCard';
import { stellarExpertUrl } from '../../lib/stellar';

const STROOPS = 10_000_000;
const INTERVAL_LABELS: Record<number, string> = { 604800: 'weekly', 1209600: 'biweekly', 2592000: 'monthly' };
function intervalLabel(secs: number) { return INTERVAL_LABELS[secs] ?? `every ${Math.round(secs / 86400)}d`; }
const UTANG_FILE_DIV = 'qr-utang-file-scanner';

export function CustomerUtang() {
  const { address } = useWallet();
  const { utangs, isLoading, refetch } = useCustomerUtangs(address);
  const { status, txHash, error, payInstallment, reset } = usePayInstallment();
  const { createUtang, isCreating } = useCreateUtang();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [paying, setPaying] = useState<UtangRecord | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('active');
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
        setUploadError('This QR is not an installment offer. Use Scan to Pay for payment QRs.');
        setTimeout(() => setUploadError(null), 5000);
      }
    } catch {
      setUploadError('Could not read QR from image. Try a clearer photo.');
      setTimeout(() => setUploadError(null), 5000);
    } finally {
      setUploadLoading(false);
      try { await scanner.clear(); } catch {}
    }
  };

  const handleAcceptOffer = async () => {
    if (!uploadedOffer || !address) return;
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
      setOfferError('Transaction failed — check wallet and try again');
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

  return (
    <div className="space-y-4 animate-page-in" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1
            className="text-xl font-black text-slate-900 leading-tight"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            My Utang
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">Iyong mga installment plans</p>
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
          {uploadLoading ? 'Reading…' : 'Upload QR'}
        </button>
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUploadQR} />

      {/* ── Upload error ── */}
      {uploadError && (
        <div
          className="rounded-2xl px-4 py-3 text-sm font-semibold"
          style={{ backgroundColor: '#FFF1F2', color: '#F43F5E', border: '1.5px solid #FECDD3' }}
        >
          {uploadError}
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
              Total Due — Next Installments
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
              {active.length} aktibong plan{active.length !== 1 ? 's' : ''}
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
          {(['active', 'completed', 'all'] as const).map((f) => (
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
              {f}
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
      {!isLoading && filtered.length === 0 && (
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
            {filter === 'active' ? 'Walang aktibong plan' : `Walang ${filter} na plans`}
          </p>
          <p className="text-sm text-slate-500 mb-5">
            Humingi ng installment QR sa iyong vendor, tapos i-scan o i-upload.
          </p>
          <div className="flex items-center justify-center gap-4">
            <div
              className="flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl"
              style={{ color: '#008055', backgroundColor: '#F0FDFA' }}
            >
              <ScanLine size={14} /> Scan QR
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl active:scale-95"
              style={{ color: '#D97706', backgroundColor: '#FEF3C7' }}
            >
              <ImageUp size={14} /> Upload QR
            </button>
          </div>
        </div>
      )}

      {/* ── Utang cards ── */}
      {!isLoading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((u) => (
            <UtangCard
              key={String(u.id)}
              utang={u}
              perspective="customer"
              onPayInstallment={handlePayClick}
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
                  Installment Credit Offer
                </p>
                <p className="text-base font-black text-slate-900 mt-0.5" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                  Suriin bago tanggapin
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
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Mga Item</p>
                    <p className="text-sm font-bold text-slate-800">{uploadedOffer.d}</p>
                  </div>
                )}
                <div className="grid grid-cols-3 divide-x divide-slate-100">
                  <div className="p-4 text-center">
                    <p className="text-xl font-black text-slate-900 leading-tight" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                      {(uploadedOffer.a / STROOPS).toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">XLM total</p>
                  </div>
                  <div className="p-4 text-center">
                    <p className="text-xl font-black text-slate-900 leading-tight" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                      {uploadedOffer.n}×
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{(uploadedOffer.a / STROOPS / uploadedOffer.n).toFixed(2)} XLM</p>
                  </div>
                  <div className="p-4 text-center">
                    <p className="text-base font-black text-slate-900 leading-tight capitalize" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                      {intervalLabel(uploadedOffer.i)}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">interval</p>
                  </div>
                </div>
                <div className="px-4 py-2.5" style={{ backgroundColor: '#FAFAFA', borderTop: '1px solid #F8FAFC' }}>
                  <p className="text-xs text-slate-400 font-mono truncate">
                    Vendor: {uploadedOffer.v.slice(0, 12)}…{uploadedOffer.v.slice(-6)}
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
                  Tanggapin at I-sign
                </button>
              )}
              {(offerAcceptStatus === 'signing' || isCreating) && (
                <div className="text-center py-5 space-y-2 rounded-2xl" style={{ backgroundColor: '#F8FAFC' }}>
                  <Loader2 className="animate-spin mx-auto" size={26} style={{ color: '#008055' }} />
                  <p className="text-sm font-bold text-slate-600">Kumpirmahin sa iyong wallet…</p>
                  <p className="text-xs text-slate-400">Sa mobile: buksan ang LOBSTR at i-approve.</p>
                </div>
              )}
              {offerAcceptStatus === 'confirmed' && (
                <div className="space-y-3">
                  <div
                    className="flex items-center gap-3 p-4 rounded-2xl"
                    style={{ backgroundColor: '#F0FDF4', border: '1.5px solid #BBF7D0' }}
                  >
                    <CheckCircle size={20} style={{ color: '#16A34A' }} />
                    <p className="text-sm font-bold text-green-800">Kasunduan tinanggap!</p>
                  </div>
                  {offerTxHash && (
                    <a
                      href={stellarExpertUrl(offerTxHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 text-xs font-bold py-3 rounded-xl w-full"
                      style={{ color: '#008055', backgroundColor: '#F0FDFA' }}
                    >
                      <ExternalLink size={12} /> Tingnan sa Stellar Expert
                    </a>
                  )}
                  <button
                    onClick={() => setUploadedOffer(null)}
                    className="w-full font-bold rounded-2xl active:scale-95 text-sm"
                    style={{ minHeight: '52px', border: '2px solid #E2E8F0', color: '#475569' }}
                  >
                    Isara
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
                Bayad ng Installment
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
                  Installment {paying.installmentsPaid + 1} of {paying.installmentsTotal}
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
                  Kumpirmahin ang Bayad
                </button>
              )}
              {(status === 'building' || status === 'signing' || status === 'submitting') && (
                <div className="text-center py-5 space-y-2 rounded-2xl" style={{ backgroundColor: '#F8FAFC' }}>
                  <Loader2 className="animate-spin mx-auto" size={26} style={{ color: '#008055' }} />
                  <p className="text-sm font-bold text-slate-600">
                    {status === 'building' ? 'Inihahanda…' : status === 'signing' ? 'Kumpirmahin sa wallet…' : 'Pinoproseso…'}
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
                    <p className="text-sm font-bold text-green-800">Bayad na!</p>
                  </div>
                  {txHash && (
                    <a
                      href={stellarExpertUrl(txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 text-xs font-bold py-3 rounded-xl w-full"
                      style={{ color: '#008055', backgroundColor: '#F0FDFA' }}
                    >
                      <ExternalLink size={12} /> Tingnan sa Stellar Expert
                    </a>
                  )}
                  <button
                    onClick={handleClosePayModal}
                    className="w-full font-bold rounded-2xl active:scale-95 text-sm"
                    style={{ minHeight: '52px', border: '2px solid #E2E8F0', color: '#475569' }}
                  >
                    Isara
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
                    Subukan Ulit
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
