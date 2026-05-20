import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowUpFromLine, Copy, Check, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useWallet } from '../../lib/hooks/useWallet';
import { usePhpRate } from '../../lib/hooks/usePhpRate';
import { quoteCashin, confirmCashin, getStatus, isTerminal, type CashinQuoteResult, type RampTxn } from '../../lib/ramp';
import { notifyWallet } from '../../lib/notify';

type Stage = 'form' | 'pay-php' | 'confirming' | 'awaiting-operator' | 'withdrawing' | 'done' | 'failed';

function stageFromStatus(status: string): Stage {
  if (status === 'completed') return 'done';
  if (status === 'error' || status === 'no_market') return 'failed';
  if (status === 'pending_stellar') return 'withdrawing';
  if (status === 'pending_external' || status === 'pending_anchor') return 'awaiting-operator';
  return 'confirming';
}

export function CustomerCashin() {
  const navigate = useNavigate();
  const { address } = useWallet();
  const { rate: phpPerXlm } = usePhpRate();

  const [amountPhp, setAmountPhp] = useState('');
  const [stage, setStage] = useState<Stage>('form');
  const [quote, setQuote] = useState<CashinQuoteResult | null>(null);
  const [latest, setLatest] = useState<RampTxn | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const phpNum = Number(amountPhp) || 0;
  const estXlm = phpPerXlm && phpPerXlm > 0 ? (phpNum / phpPerXlm).toFixed(4) : null;
  const canSubmit = address && phpNum >= 50;

  const handleQuote = async () => {
    if (!address) return;
    setErrorMsg(null);
    try {
      const q = await quoteCashin({ wallet: address, amountPhp: phpNum.toFixed(2) });
      setQuote(q);
      setStage('pay-php');
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
    }
  };

  const handleConfirm = async () => {
    if (!quote) return;
    setStage('confirming');
    try {
      const r = await confirmCashin({ id: quote.id, reference: quote.instructions.reference });
      setStage(stageFromStatus(r.status));
      if (address) notifyWallet(address, {
        title: 'PalengkePay — payment received',
        body: r.status === 'completed' ? 'XLM in your wallet' : 'Waiting on operator to release XLM',
        url: '/customer/profile',
      });
    } catch (err: unknown) {
      setStage('failed');
      setErrorMsg((err as Error).message);
    }
  };

  useEffect(() => {
    if (!quote) return;
    if (stage !== 'confirming' && stage !== 'awaiting-operator' && stage !== 'withdrawing') return;
    const interval = setInterval(async () => {
      const t = await getStatus(quote.id);
      if (!t) return;
      setLatest(t);
      const next = stageFromStatus(t.status);
      setStage(next);
      if (isTerminal(t.status)) clearInterval(interval);
    }, 4000);
    return () => clearInterval(interval);
  }, [quote, stage]);

  const handleCopy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* noop */ }
  };

  return (
    <div className="space-y-4 animate-page-in max-w-md">
      <button onClick={() => navigate('/customer/profile')} className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
        <ArrowLeft size={14} /> Back
      </button>

      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#F0FDFA' }}>
          <ArrowUpFromLine size={20} style={{ color: '#008055' }} />
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>Cash In</h1>
          <p className="text-xs text-slate-400">PHP → XLM via PDAX</p>
        </div>
      </div>

      {stage === 'form' && (
        <div className="space-y-3">
          <div className="rounded-2xl p-4 bg-white border" style={{ borderColor: '#F1F5F9' }}>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Amount (PHP)</span>
              <input
                type="number"
                inputMode="decimal"
                value={amountPhp}
                onChange={(e) => setAmountPhp(e.target.value)}
                placeholder="0.00"
                className="mt-2 w-full text-2xl font-black text-slate-900 outline-none"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-slate-400">Min 50 PHP</span>
                {estXlm && <span className="text-xs font-bold" style={{ color: '#008055' }}>≈ {estXlm} XLM</span>}
              </div>
            </label>
          </div>

          {errorMsg && <p className="text-xs text-red-500 px-1">{errorMsg}</p>}

          <button
            disabled={!canSubmit}
            onClick={handleQuote}
            className="w-full py-3 rounded-2xl font-black text-white disabled:opacity-40 active:scale-[0.98] transition-all"
            style={{ backgroundColor: '#008055', fontFamily: "'Montserrat', sans-serif" }}
          >
            Get quote
          </button>
          <p className="text-[11px] text-slate-400 text-center">Powered by PDAX (mock mode in dev)</p>
        </div>
      )}

      {stage === 'pay-php' && quote && (
        <div className="space-y-3">
          <div className="rounded-2xl p-4 bg-white border space-y-3" style={{ borderColor: '#F1F5F9' }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">You pay</span>
              <span className="font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>PHP {quote.amountPhp}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">You receive</span>
              <span className="font-black" style={{ color: '#008055', fontFamily: "'Montserrat', sans-serif" }}>{quote.amountXlm} XLM</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Rate</span>
              <span className="text-xs text-slate-500">1 XLM = PHP {quote.rate}</span>
            </div>
          </div>

          <div className="rounded-2xl p-4 bg-white border space-y-2" style={{ borderColor: '#F1F5F9' }}>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Pay via {quote.instructions.rail}</p>
            <p className="text-xs text-slate-500">Send PHP {quote.amountPhp} from your bank/e-wallet to PalengkePay PDAX. Use this reference:</p>
            <div className="flex items-center justify-between rounded-xl px-3 py-2" style={{ backgroundColor: '#F8FAFC' }}>
              <span className="font-mono text-sm font-bold">{quote.instructions.reference}</span>
              <button onClick={() => handleCopy(quote.instructions.reference)} className="px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1" style={{ backgroundColor: '#F0FDFA', color: '#008055' }}>
                {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">Quote expires {new Date(quote.expiresAt).toLocaleTimeString()}</p>
          </div>

          <button
            onClick={handleConfirm}
            className="w-full py-3 rounded-2xl font-black text-white active:scale-[0.98] transition-all"
            style={{ backgroundColor: '#008055', fontFamily: "'Montserrat', sans-serif" }}
          >
            I have paid — proceed
          </button>
          <button onClick={() => setStage('form')} className="w-full py-2 text-xs text-slate-500 font-bold">Cancel</button>
        </div>
      )}

      {(stage === 'confirming' || stage === 'awaiting-operator' || stage === 'withdrawing') && (
        <div className="rounded-2xl p-6 bg-white border text-center space-y-3" style={{ borderColor: '#F1F5F9' }}>
          <Loader2 size={32} className="mx-auto animate-spin" style={{ color: '#008055' }} />
          <p className="font-bold text-slate-900">
            {stage === 'confirming' && 'Submitting payment claim…'}
            {stage === 'awaiting-operator' && 'Waiting for operator to confirm your PHP payment'}
            {stage === 'withdrawing' && 'Sending XLM to your wallet…'}
          </p>
          <p className="text-xs text-slate-400">
            {stage === 'awaiting-operator'
              ? 'We will push-notify you once operator releases XLM. You can close this page.'
              : (latest?.message ?? 'Please keep this page open')}
          </p>
        </div>
      )}

      {stage === 'done' && latest && (
        <div className="rounded-2xl p-6 bg-white border text-center space-y-3" style={{ borderColor: '#F1F5F9' }}>
          <CheckCircle2 size={40} className="mx-auto" style={{ color: '#008055' }} />
          <p className="font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>Cashin complete</p>
          <p className="text-sm text-slate-500">{latest.amountOut ?? '—'} XLM in your wallet</p>
          <button onClick={() => navigate('/customer/profile')} className="mt-3 px-6 py-2 rounded-xl font-bold text-white" style={{ backgroundColor: '#008055' }}>Done</button>
        </div>
      )}

      {stage === 'failed' && (
        <div className="rounded-2xl p-6 bg-white border text-center space-y-3" style={{ borderColor: '#FECACA' }}>
          <XCircle size={40} className="mx-auto text-red-500" />
          <p className="font-black text-slate-900">Cashin failed</p>
          <p className="text-xs text-red-500">{errorMsg ?? 'Unknown error'}</p>
          <button onClick={() => { setStage('form'); setQuote(null); setErrorMsg(null); }} className="mt-3 px-6 py-2 rounded-xl font-bold" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>Try again</button>
        </div>
      )}
    </div>
  );
}
