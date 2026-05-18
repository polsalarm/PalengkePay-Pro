import { useState } from 'react';
import { Loader2, Lock, CheckCircle, XCircle, ExternalLink, Zap, Share2, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { TxStatus } from '../lib/hooks/usePayment';
import { stellarExpertUrl } from '../lib/stellar';
import { shareReceipt } from '../lib/receipt';

interface Props {
  status: TxStatus;
  txHash: string | null;
  error: string | null;
  amount?: string;
  recipientName?: string;
  fee?: string;
  onRetry?: () => void;
}

const BASE_FEE = '0.00001';

export function TxStatusTracker({ status, txHash, error, amount, recipientName, fee, onRetry }: Props) {
  const [shareState, setShareState] = useState<'idle' | 'sharing' | 'copied'>('idle');

  if (status === 'idle') return null;

  const displayFee = fee ?? BASE_FEE;

  const handleShare = async () => {
    if (!txHash) return;
    setShareState('sharing');
    try {
      const result = await shareReceipt(txHash, recipientName, amount);
      setShareState(result === 'copied' ? 'copied' : 'idle');
      if (result === 'copied') setTimeout(() => setShareState('idle'), 2000);
    } catch {
      setShareState('idle');
    }
  };

  if (status === 'building') {
    return (
      <div
        className="rounded-3xl p-5 flex items-center gap-4"
        style={{ backgroundColor: '#00284B', border: '1.5px solid rgba(255,255,255,0.06)' }}
      >
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
        >
          <Loader2 size={20} className="animate-spin" style={{ color: '#14B8A6' }} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-white">Preparing transaction…</p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Network fee: {displayFee} XLM · sponsored
          </p>
        </div>
      </div>
    );
  }

  if (status === 'signing') {
    return (
      <div
        className="rounded-3xl p-5 flex items-center gap-4 animate-border-pulse"
        style={{ backgroundColor: '#00284B', border: '1.5px solid #14B8A6' }}
      >
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: 'rgba(20,184,166,0.15)' }}
        >
          <Lock size={20} style={{ color: '#14B8A6' }} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-white">Kumpirmahin sa wallet</p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Mobile: buksan ang LOBSTR at i-approve. Desktop: check browser extension.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'submitting') {
    return (
      <div
        className="rounded-3xl p-5 flex items-center gap-4"
        style={{ backgroundColor: '#FFFBEB', border: '1.5px solid #FDE68A' }}
      >
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: 'rgba(245,158,11,0.15)' }}
        >
          <Zap size={20} style={{ color: '#D97706' }} className="animate-pulse" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold" style={{ color: '#92400E' }}>Processing on Stellar…</p>
          <p className="text-xs mt-0.5" style={{ color: '#D97706' }}>
            Karaniwang 3–5 segundo lang
          </p>
        </div>
      </div>
    );
  }

  if (status === 'confirmed') {
    return (
      <div className="rounded-3xl overflow-hidden" style={{ border: '1.5px solid #BBF7D0' }}>
        <div
          className="p-5 flex items-center gap-4"
          style={{ backgroundColor: '#F0FDF4' }}
        >
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: '#DCFCE7' }}
          >
            <CheckCircle size={20} style={{ color: '#16A34A' }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black" style={{ color: '#15803D', fontFamily: "'Montserrat', sans-serif" }}>
              Bayad na!
            </p>
            {amount && recipientName && (
              <p className="text-xs mt-0.5" style={{ color: '#16A34A' }}>
                {amount} XLM → {recipientName}
              </p>
            )}
          </div>
        </div>
        {txHash && (
          <div
            className="bg-white"
            style={{ borderTop: '1px solid #BBF7D0' }}
          >
            <div className="px-5 pt-3 pb-2 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Fee: <span className="font-mono">{displayFee} XLM</span>
              </span>
              <a
                href={stellarExpertUrl(txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-bold active:scale-95"
                style={{ color: '#008055' }}
              >
                <ExternalLink size={11} /> Stellar Expert
              </a>
            </div>
            <div className="px-5 pb-4 pt-2 grid grid-cols-2 gap-2">
              <button
                onClick={handleShare}
                disabled={shareState === 'sharing'}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-xs text-white active:scale-95 transition-all disabled:opacity-60"
                style={{ backgroundColor: '#008055' }}
              >
                {shareState === 'sharing' ? <Loader2 size={13} className="animate-spin" />
                  : shareState === 'copied' ? <><Check size={13} /> Link copied</>
                  : <><Share2 size={13} /> Share Receipt</>}
              </button>
              <Link
                to={`/receipt/${txHash}`}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-xs active:scale-95 transition-all"
                style={{ backgroundColor: '#F0FDF4', color: '#15803D', border: '1.5px solid #BBF7D0' }}
              >
                <ExternalLink size={12} /> View Receipt
              </Link>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="rounded-3xl overflow-hidden" style={{ border: '1.5px solid #FECDD3' }}>
        <div
          className="p-5 flex items-center gap-4"
          style={{ backgroundColor: '#FFF1F2' }}
        >
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: '#FFE4E6' }}
          >
            <XCircle size={20} style={{ color: '#F43F5E' }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black" style={{ color: '#BE123C', fontFamily: "'Montserrat', sans-serif" }}>
              Transaction failed
            </p>
            {error && (
              <p className="text-xs mt-0.5 font-mono" style={{ color: '#F43F5E' }}>{error}</p>
            )}
          </div>
        </div>
        {onRetry && (
          <div className="px-5 py-3 bg-white" style={{ borderTop: '1px solid #FECDD3' }}>
            <button
              onClick={onRetry}
              className="text-sm font-bold px-5 py-2 rounded-xl active:scale-95 transition-all text-white"
              style={{ backgroundColor: '#F43F5E' }}
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    );
  }

  return null;
}
