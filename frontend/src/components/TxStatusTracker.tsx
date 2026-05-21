import { Edit3, Loader2, Lock, CheckCircle, XCircle, ExternalLink, RotateCcw, Search, Zap } from 'lucide-react';
import type { TxStatus } from '../lib/hooks/usePayment';
import { stellarExpertUrl } from '../lib/stellar';

interface Props {
  status: TxStatus;
  txHash: string | null;
  error: string | null;
  amount?: string;
  recipientName?: string;
  fee?: string;
  diagnostic?: string | null;
  receiptLookupUrl?: string;
  onRetry?: () => void;
  onEdit?: () => void;
  onScanAgain?: () => void;
}

const BASE_FEE = '0.00001';

export function TxStatusTracker({
  status,
  txHash,
  error,
  amount,
  recipientName,
  fee,
  diagnostic,
  receiptLookupUrl,
  onRetry,
  onEdit,
  onScanAgain,
}: Props) {
  if (status === 'idle') return null;

  const displayFee = fee ?? BASE_FEE;

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
        <div
          className="px-5 py-3 flex items-center justify-between"
          style={{ backgroundColor: 'white', borderTop: '1px solid #BBF7D0' }}
        >
          <span className="text-xs text-slate-400">
            Fee: <span className="font-mono">{displayFee} XLM</span>
          </span>
          {txHash && (
            <a
              href={stellarExpertUrl(txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-bold active:scale-95"
              style={{ color: '#008055' }}
            >
              <ExternalLink size={11} /> Stellar Expert
            </a>
          )}
        </div>
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
            {error && <p className="text-xs mt-0.5 font-semibold" style={{ color: '#F43F5E' }}>{error}</p>}
            {diagnostic && (
              <p className="text-xs mt-2 leading-relaxed" style={{ color: '#9F1239' }}>
                {diagnostic}
              </p>
            )}
          </div>
        </div>
        {(onRetry || onEdit || onScanAgain || receiptLookupUrl) && (
          <div className="px-5 py-3 bg-white space-y-2" style={{ borderTop: '1px solid #FECDD3' }}>
            {onRetry && (
              <button
                onClick={onRetry}
                className="w-full flex items-center justify-center gap-2 text-sm font-bold px-5 py-3 rounded-xl active:scale-95 transition-all text-white"
                style={{ backgroundColor: '#F43F5E' }}
              >
                <RotateCcw size={14} /> Retry same payment
              </button>
            )}
            <div className="grid grid-cols-2 gap-2">
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2.5 rounded-xl active:scale-95 transition-all"
                  style={{ color: '#475569', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}
                >
                  <Edit3 size={12} /> Edit details
                </button>
              )}
              {onScanAgain && (
                <button
                  onClick={onScanAgain}
                  className="flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2.5 rounded-xl active:scale-95 transition-all"
                  style={{ color: '#475569', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}
                >
                  <Search size={12} /> Scan again
                </button>
              )}
            </div>
            {receiptLookupUrl && (
              <a
                href={receiptLookupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2.5 rounded-xl active:scale-95"
                style={{ color: '#008055', backgroundColor: '#F0FDFA' }}
              >
                <ExternalLink size={12} /> Check recent receipts
              </a>
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
}
