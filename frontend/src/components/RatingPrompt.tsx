import { useState } from 'react';
import { Star, Check, Loader2, X } from 'lucide-react';
import { useWallet } from '../lib/hooks/useWallet';
import { useHasRated, useSubmitRating } from '../lib/hooks/useRating';
import { sha256Hex, zeroCommentHashHex, storeCommentLocally } from '../lib/rating';
import { useToast } from '../lib/hooks/useToast';

interface Props {
  vendorAddress: string;
  vendorName: string;
  paymentTxHash: string;
}

export function RatingPrompt({ vendorAddress, vendorName, paymentTxHash }: Props) {
  const { address: customer } = useWallet();
  const { showToast } = useToast();
  const hasRated = useHasRated(vendorAddress, paymentTxHash);
  const { submit, isSubmitting } = useSubmitRating();

  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (hasRated === true || submitted) {
    return (
      <div
        className="rounded-2xl p-4 flex items-center gap-3"
        style={{ backgroundColor: '#F0FDF4', border: '1.5px solid #BBF7D0' }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: '#DCFCE7' }}
        >
          <Check size={16} style={{ color: '#16A34A' }} />
        </div>
        <p className="text-xs font-semibold" style={{ color: '#15803D' }}>
          Salamat sa rating! Naka-record na on-chain.
        </p>
      </div>
    );
  }

  if (dismissed) return null;

  const needsComment = stars > 0 && stars <= 3;

  const handleSubmit = async () => {
    if (!customer || stars === 0) return;
    const commentHash = comment.trim()
      ? await sha256Hex(comment.trim())
      : zeroCommentHashHex();
    if (comment.trim()) storeCommentLocally(commentHash, comment.trim());
    const ok = await submit(customer, vendorAddress, paymentTxHash, stars, commentHash);
    if (ok) {
      setSubmitted(true);
      showToast('Rating submitted!', 'success');
    } else {
      showToast('Could not submit rating', 'error');
    }
  };

  return (
    <div
      className="rounded-2xl p-5"
      style={{ backgroundColor: 'white', border: '1.5px solid #F1F5F9', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-start justify-between mb-3 gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-1 text-slate-400">
            Kumusta ang experience?
          </p>
          <p className="text-sm font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            Rate {vendorName}
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="w-7 h-7 rounded-lg flex items-center justify-center active:scale-95 shrink-0"
          style={{ backgroundColor: '#F8FAFC', color: '#94A3B8' }}
          aria-label="Dismiss"
        >
          <X size={13} />
        </button>
      </div>

      <div
        className="flex items-center justify-center gap-2 mb-4"
        onMouseLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = (hover || stars) >= n;
          return (
            <button
              key={n}
              onClick={() => setStars(n)}
              onMouseEnter={() => setHover(n)}
              className="p-1 active:scale-90 transition-transform"
              aria-label={`${n} star${n !== 1 ? 's' : ''}`}
            >
              <Star
                size={32}
                fill={filled ? '#FACC15' : 'transparent'}
                style={{ color: filled ? '#FACC15' : '#CBD5E1' }}
                strokeWidth={1.5}
              />
            </button>
          );
        })}
      </div>

      {needsComment && (
        <div className="mb-3">
          <label className="block text-xs font-bold text-slate-500 mb-1.5">
            Ano ang nangyari? (optional)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 280))}
            placeholder="Pwede mong i-share ang reason para sa low rating…"
            rows={2}
            className="w-full text-sm rounded-xl px-3 py-2 outline-none transition-all resize-none"
            style={{ border: '1.5px solid #E2E8F0' }}
          />
          <p className="text-[10px] text-slate-400 mt-1 text-right">{comment.length}/280</p>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={stars === 0 || isSubmitting}
        className="w-full font-bold text-sm py-3 rounded-2xl active:scale-95 transition-all text-white disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ backgroundColor: '#008055' }}
      >
        {isSubmitting ? <><Loader2 size={14} className="animate-spin" /> Submitting…</>
          : stars === 0 ? 'Pumili ng stars'
          : `I-submit ang ${stars}-star rating`}
      </button>

      <p className="text-[10px] text-slate-400 text-center mt-3">
        Naka-record on-chain. Hindi mababago after submit.
      </p>
    </div>
  );
}
