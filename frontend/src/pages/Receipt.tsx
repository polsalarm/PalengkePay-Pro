import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CheckCircle2, ExternalLink, Copy, Check, Share2, Loader2, AlertCircle, ArrowLeft, ShieldCheck,
} from 'lucide-react';
import { fetchReceipt, shareReceipt, receiptUrl, type Receipt as ReceiptData } from '../lib/receipt';
import { truncateAddress } from '../lib/stellar';
import logoImg2 from '../assets/logo-2.png';

function formatDate(iso: string): { date: string; time: string } {
  try {
    const d = new Date(iso);
    return {
      date: d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }),
      time: d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true }),
    };
  } catch {
    return { date: iso, time: '' };
  }
}

function setOgMeta(receipt: ReceiptData) {
  const vendor = receipt.vendor?.name ?? 'a PalengkePay vendor';
  const title = `Receipt — ${receipt.amountXlm} XLM to ${vendor}`;
  const description = `On-chain payment receipt verified on Stellar. ${receipt.memo ? `"${receipt.memo}" · ` : ''}${vendor}.`;
  document.title = `${title} · PalengkePay`;

  const ensure = (selector: string, attrs: Record<string, string>) => {
    let el = document.head.querySelector(selector) as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement('meta');
      document.head.appendChild(el);
    }
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  };

  ensure('meta[property="og:title"]', { property: 'og:title', content: title });
  ensure('meta[property="og:description"]', { property: 'og:description', content: description });
  ensure('meta[property="og:type"]', { property: 'og:type', content: 'website' });
  ensure('meta[property="og:url"]', { property: 'og:url', content: receiptUrl(receipt.txHash) });
  ensure('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary' });
  ensure('meta[name="twitter:title"]', { name: 'twitter:title', content: title });
  ensure('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
}

export function Receipt() {
  const { txHash } = useParams<{ txHash: string }>();
  const navigate = useNavigate();
  const hasHistory = typeof window !== 'undefined' && window.history.length > 1;
  const goBack = () => {
    if (hasHistory) navigate(-1);
    else navigate('/');
  };
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareState, setShareState] = useState<'idle' | 'sharing' | 'copied'>('idle');

  useEffect(() => {
    if (!txHash) { setError('Missing transaction hash'); setIsLoading(false); return; }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetchReceipt(txHash)
      .then((r) => {
        if (cancelled) return;
        setReceipt(r);
        setOgMeta(r);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg = (e as { message?: string }).message ?? 'Failed to load receipt';
        setError(msg.includes('Not Found') || msg.includes('404') ? 'Receipt not found. Double-check the link.' : msg);
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [txHash]);

  const handleCopyHash = async () => {
    if (!receipt) return;
    try {
      await navigator.clipboard.writeText(receipt.txHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const handleShare = async () => {
    if (!receipt) return;
    setShareState('sharing');
    try {
      const result = await shareReceipt(receipt.txHash, receipt.vendor?.name, receipt.amountXlm);
      setShareState(result === 'copied' ? 'copied' : 'idle');
      if (result === 'copied') setTimeout(() => setShareState('idle'), 2000);
    } catch {
      setShareState('idle');
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center px-4 py-6 sm:py-10"
      style={{ backgroundColor: '#F8FAFC', fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* Header */}
      <header className="w-full max-w-md flex items-center justify-between mb-6">
        <Link to="/" className="flex items-center gap-2 active:scale-95 transition-transform">
          <img src={logoImg2} alt="PalengkePay" className="w-8 h-8 rounded-lg object-cover" />
          <span className="font-black text-base" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            <span style={{ color: '#0F172A' }}>Palengke</span>
            <span style={{ color: '#008055' }}>Pay</span>
          </span>
        </Link>
        <button
          onClick={goBack}
          className="flex items-center gap-1 text-xs font-semibold text-slate-500 active:scale-95"
        >
          <ArrowLeft size={13} /> {hasHistory ? 'Back' : 'Home'}
        </button>
      </header>

      {isLoading && (
        <div className="w-full max-w-md flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin" style={{ color: '#008055' }} />
        </div>
      )}

      {error && !isLoading && (
        <div
          className="w-full max-w-md rounded-3xl p-6 flex flex-col items-center text-center"
          style={{ backgroundColor: 'white', border: '1.5px solid #FECDD3' }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ backgroundColor: '#FFE4E6' }}
          >
            <AlertCircle size={26} style={{ color: '#F43F5E' }} />
          </div>
          <p className="font-black text-base mb-1" style={{ fontFamily: "'Montserrat', sans-serif", color: '#BE123C' }}>
            Receipt unavailable
          </p>
          <p className="text-xs text-slate-500 mb-4">{error}</p>
          <Link
            to="/"
            className="text-xs font-bold px-4 py-2 rounded-xl active:scale-95 text-white"
            style={{ backgroundColor: '#008055' }}
          >
            Go to PalengkePay
          </Link>
        </div>
      )}

      {receipt && !isLoading && !error && (
        <article
          className="w-full max-w-md rounded-3xl overflow-hidden"
          style={{ backgroundColor: 'white', boxShadow: '0 8px 32px rgba(15,23,42,0.08)', border: '1.5px solid #F1F5F9' }}
        >
          {/* Hero — success */}
          <div
            className="px-6 pt-8 pb-6 flex flex-col items-center text-center"
            style={{
              background: 'linear-gradient(180deg, #F0FDF4 0%, #FFFFFF 100%)',
              borderBottom: '1px solid #F1F5F9',
            }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
              style={{ backgroundColor: '#DCFCE7' }}
            >
              <CheckCircle2 size={28} style={{ color: '#16A34A' }} />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: '#16A34A' }}>
              Payment verified
            </p>
            <p
              className="font-black leading-none mb-1"
              style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '2.25rem', color: '#0F172A' }}
            >
              {receipt.amountXlm}
              <span className="text-base font-bold ml-2" style={{ color: '#64748B' }}>XLM</span>
            </p>
            {receipt.memo && (
              <p className="text-sm text-slate-500 mt-3 italic">"{receipt.memo}"</p>
            )}
          </div>

          {/* Vendor block */}
          <div className="px-6 py-5" style={{ borderBottom: '1px solid #F1F5F9' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2 text-slate-400">Paid to</p>
            {receipt.vendor ? (
              <div>
                <p className="font-black text-base text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                  {receipt.vendor.name}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Stall {receipt.vendor.stallNumber} · <span className="capitalize">{receipt.vendor.productType}</span>
                </p>
                <p className="text-[10px] font-mono mt-2 text-slate-400">{truncateAddress(receipt.to)}</p>
              </div>
            ) : (
              <div>
                <p className="font-bold text-sm text-slate-700">Unregistered wallet</p>
                <p className="text-[10px] font-mono mt-1 text-slate-400">{truncateAddress(receipt.to)}</p>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="px-6 py-5 space-y-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
            <Row label="From" value={truncateAddress(receipt.from)} mono />
            <Row label="Date" value={formatDate(receipt.createdAt).date} />
            <Row label="Time" value={formatDate(receipt.createdAt).time} />
            <Row label="Network fee" value={`${receipt.feeChargedXlm} XLM (sponsored)`} />
          </div>

          {/* Tx hash */}
          <div className="px-6 py-5" style={{ borderBottom: '1px solid #F1F5F9' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2 text-slate-400">Transaction hash</p>
            <div className="flex items-center gap-2">
              <code
                className="flex-1 text-[11px] font-mono px-3 py-2 rounded-lg break-all"
                style={{ backgroundColor: '#F8FAFC', color: '#334155', border: '1px solid #E2E8F0' }}
              >
                {receipt.txHash}
              </code>
              <button
                onClick={handleCopyHash}
                className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center active:scale-95 transition-all"
                style={{ backgroundColor: copied ? '#DCFCE7' : '#F1F5F9', color: copied ? '#16A34A' : '#475569' }}
                aria-label="Copy transaction hash"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="px-6 py-5 grid grid-cols-2 gap-3">
            <button
              onClick={handleShare}
              disabled={shareState === 'sharing'}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-bold text-sm text-white active:scale-95 transition-all disabled:opacity-60"
              style={{ backgroundColor: '#008055' }}
            >
              {shareState === 'sharing' ? <Loader2 size={15} className="animate-spin" />
                : shareState === 'copied' ? <><Check size={15} /> Copied</>
                : <><Share2 size={15} /> Share</>}
            </button>
            <a
              href={receipt.stellarExpertUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-bold text-sm active:scale-95 transition-all"
              style={{ backgroundColor: '#F1F5F9', color: '#0F172A', border: '1.5px solid #E2E8F0' }}
            >
              <ExternalLink size={14} /> Verify
            </a>
          </div>

          {/* Footer trust badge */}
          <div
            className="px-6 py-4 flex items-center justify-center gap-2"
            style={{ backgroundColor: '#F8FAFC', borderTop: '1px solid #F1F5F9' }}
          >
            <ShieldCheck size={13} style={{ color: '#008055' }} />
            <p className="text-[10px] font-semibold text-slate-500">
              Powered by Stellar blockchain · Tamper-proof
            </p>
          </div>
        </article>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`text-xs text-slate-700 font-semibold ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}
