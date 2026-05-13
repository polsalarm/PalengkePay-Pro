import { useState, useEffect } from 'react';
import { Store, Zap } from 'lucide-react';
import type { VendorProfile } from '../lib/hooks/useVendor';

const MEMO_MAX = 28;
const XLM_TO_PHP = 8.5;

interface Props {
  vendorAddress: string;
  vendor: VendorProfile | null;
  isLoading: boolean;
  preloadedVendorName?: string;
  preloadedStallInfo?: string;
  onSubmit: (amount: string, memo: string) => void;
  disabled?: boolean;
}

export function PaymentForm({ vendorAddress, vendor, isLoading, preloadedVendorName, preloadedStallInfo, onSubmit, disabled }: Props) {
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [error, setError] = useState('');
  const [phpRate, setPhpRate] = useState<number>(XLM_TO_PHP);

  useEffect(() => {
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=php')
      .then((r) => r.json())
      .then((d) => { if (d?.stellar?.php) setPhpRate(d.stellar.php); })
      .catch(() => {});
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!amount || parseFloat(amount) <= 0) {
      setError('Enter amount greater than 0');
      return;
    }
    onSubmit(amount, memo);
  };

  const displayName = vendor?.name ?? preloadedVendorName ?? null;
  const displayStall = vendor
    ? `Stall ${vendor.stallNumber} · ${vendor.productType}`
    : preloadedStallInfo ?? null;

  const xlmAmt = parseFloat(amount);
  const phpEst = !isNaN(xlmAmt) && xlmAmt > 0 ? (xlmAmt * phpRate).toFixed(2) : null;
  const memoLeft = MEMO_MAX - memo.length;
  const memoNearLimit = memoLeft <= 8;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">

      {/* ── Vendor card ── */}
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
        <div className="min-w-0 flex-1">
          {isLoading && !preloadedVendorName ? (
            <>
              <div className="h-4 w-32 skeleton rounded mb-1.5" />
              <div className="h-3 w-24 skeleton rounded" />
            </>
          ) : displayName ? (
            <>
              <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: '#008055' }}>
                Nagbabayad kay
              </p>
              <p className="text-base font-black text-slate-900 truncate" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                {displayName}
              </p>
              {displayStall && (
                <p className="text-xs text-slate-400 mt-0.5">{displayStall}</p>
              )}
            </>
          ) : (
            <>
              <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: '#008055' }}>
                Nagbabayad sa
              </p>
              <p className="text-sm font-mono text-slate-500 truncate">{vendorAddress}</p>
            </>
          )}
        </div>
      </div>

      {/* ── Amount ── */}
      <div>
        <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
          Halaga (XLM)
        </label>
        <div className="relative">
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.01"
            className="w-full rounded-2xl px-4 font-black text-slate-900 focus:outline-none transition-all"
            style={{
              border: '2px solid #E2E8F0',
              padding: '16px',
              fontSize: '1.6rem',
              letterSpacing: '-0.02em',
              fontFamily: "'Montserrat', sans-serif",
            }}
            onFocus={(e) => { e.target.style.borderColor = '#008055'; }}
            onBlur={(e) => { e.target.style.borderColor = '#E2E8F0'; }}
            autoFocus
          />
        </div>
        {phpEst && (
          <p className="text-xs text-right mt-1.5 font-medium" style={{ color: '#64748B' }}>
            ≈ <span className="font-black" style={{ color: '#008055' }}>₱{phpEst}</span>
            <span className="text-slate-300 ml-1">(approx)</span>
          </p>
        )}
      </div>

      {/* ── Memo ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-black uppercase tracking-wider text-slate-500">
            Ano ang binili? <span className="font-normal normal-case tracking-normal text-slate-400">(optional)</span>
          </label>
          <span
            className="text-xs font-bold tabular-nums"
            style={{ color: memoNearLimit ? '#F59E0B' : '#CBD5E1' }}
          >
            {memo.length}/{MEMO_MAX}
          </span>
        </div>
        <input
          type="text"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="e.g. 2kg tilapia"
          maxLength={MEMO_MAX}
          className="w-full rounded-2xl px-4 py-3.5 text-sm font-semibold text-slate-800 focus:outline-none transition-all placeholder:font-normal placeholder:text-slate-300"
          style={{ border: '2px solid #E2E8F0' }}
          onFocus={(e) => { e.target.style.borderColor = '#008055'; }}
          onBlur={(e) => { e.target.style.borderColor = '#E2E8F0'; }}
        />
      </div>

      {error && (
        <p className="text-xs font-semibold px-1" style={{ color: '#F43F5E' }}>{error}</p>
      )}

      {/* ── Gasless badge ── */}
      <div
        className="flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold"
        style={{ backgroundColor: '#F0FDF4', color: '#16A34A' }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#22C55E' }} />
        Gasless — fees sponsored, zero cost sa iyo
      </div>

      {/* ── Submit ── */}
      <button
        type="submit"
        disabled={disabled}
        className="w-full text-white font-black rounded-2xl active:scale-95 transition-all disabled:opacity-40"
        style={{
          backgroundColor: '#008055',
          minHeight: '60px',
          fontSize: '1.05rem',
          fontFamily: "'Montserrat', sans-serif",
          boxShadow: '0 6px 24px rgba(15,118,110,0.35)',
        }}
      >
        <Zap size={16} className="inline mr-2 -mt-0.5" />
        Bayaran Ngayon
      </button>
    </form>
  );
}
