import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowDownToLine, Copy, Check, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useWallet } from '../../lib/hooks/useWallet';
import { useBalance } from '../../lib/hooks/useBalance';
import { usePhpRate } from '../../lib/hooks/usePhpRate';
import { usePayment } from '../../lib/hooks/usePayment';
import {
  createCashout, settleCashout, getStatus, isTerminal,
  RAIL_LABELS, type Rail, type CashoutCreateResult, type RampTxn,
} from '../../lib/ramp';
import { notifyWallet } from '../../lib/notify';

type Stage = 'form' | 'send-xlm' | 'sending' | 'swapping' | 'paying-out' | 'done' | 'failed';

export function CustomerCashout() {
  const navigate = useNavigate();
  const { address } = useWallet();
  const { balance } = useBalance(address);
  const { rate: phpPerXlm } = usePhpRate();
  const { status: payStatus, txHash, error: payError, sendPayment, reset } = usePayment();

  const [amountXlm, setAmountXlm] = useState('');
  const [rail, setRail] = useState<Rail>('INSTAPAY');
  const [destination, setDestination] = useState('');
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [stage, setStage] = useState<Stage>('form');
  const [order, setOrder] = useState<CashoutCreateResult | null>(null);
  const [latest, setLatest] = useState<RampTxn | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const xlmNum = Number(amountXlm) || 0;
  const estPhp = phpPerXlm ? (xlmNum * phpPerXlm).toFixed(2) : null;
  const balanceNum = balance ? parseFloat(balance) : 0;
  const canSubmit = address && xlmNum >= 5 && xlmNum <= balanceNum - 1 && destination.trim() && beneficiaryName.trim();

  const handleCreate = async () => {
    if (!address) return;
    setErrorMsg(null);
    try {
      const res = await createCashout({ wallet: address, amountXlm: xlmNum.toFixed(7), rail, destination: destination.trim(), beneficiaryName: beneficiaryName.trim() });
      setOrder(res);
      setStage('send-xlm');
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
    }
  };

  const handleSend = async () => {
    if (!order || !address) return;
    reset();
    setStage('sending');
    await sendPayment(address, order.depositAddress, order.amountXlm, order.memo);
  };

  useEffect(() => {
    if (stage !== 'sending') return;
    if (payStatus === 'confirmed' && txHash && order) {
      setStage('swapping');
      settleCashout({ id: order.id, stellarTxHash: txHash })
        .then((r) => {
          setStage(r.status === 'completed' ? 'done' : 'paying-out');
          if (address) notifyWallet(address, {
            title: r.status === 'completed' ? 'PalengkePay — cashout complete' : 'PalengkePay — paying out',
            body: r.status === 'completed' ? `PHP ${r.amountOut} sent to ${rail}` : 'PHP rail in flight, you will be notified',
            url: '/customer/profile',
          });
        })
        .catch((err: Error) => {
          setStage('failed');
          setErrorMsg(err.message);
        });
    }
    if (payStatus === 'failed') {
      setStage('failed');
      setErrorMsg(payError);
    }
  }, [payStatus, txHash, payError, stage, order, address, rail]);

  useEffect(() => {
    if (!order || stage !== 'paying-out') return;
    const interval = setInterval(async () => {
      const t = await getStatus(order.id);
      if (!t) return;
      setLatest(t);
      if (isTerminal(t.status)) {
        clearInterval(interval);
        setStage(t.status === 'completed' ? 'done' : 'failed');
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [order, stage]);

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
          <ArrowDownToLine size={20} style={{ color: '#008055' }} />
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>Cash Out</h1>
          <p className="text-xs text-slate-400">XLM → PHP via PDAX</p>
        </div>
      </div>

      {stage === 'form' && (
        <div className="space-y-3">
          <div className="rounded-2xl p-4 bg-white border" style={{ borderColor: '#F1F5F9' }}>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Amount (XLM)</span>
              <input
                type="number"
                inputMode="decimal"
                value={amountXlm}
                onChange={(e) => setAmountXlm(e.target.value)}
                placeholder="0.00"
                className="mt-2 w-full text-2xl font-black text-slate-900 outline-none"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-slate-400">Balance: {balance ?? '—'} XLM</span>
                {estPhp && <span className="text-xs font-bold" style={{ color: '#008055' }}>≈ PHP {estPhp}</span>}
              </div>
            </label>
          </div>

          <div className="rounded-2xl p-4 bg-white border space-y-3" style={{ borderColor: '#F1F5F9' }}>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Payout method</span>
              <select
                value={rail}
                onChange={(e) => setRail(e.target.value as Rail)}
                className="mt-2 w-full px-3 py-2 rounded-xl border text-sm font-bold"
                style={{ borderColor: '#E2E8F0' }}
              >
                {(Object.keys(RAIL_LABELS) as Rail[]).map((r) => (
                  <option key={r} value={r}>{RAIL_LABELS[r]}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Account / Number</span>
              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder={rail === 'EWALLET' ? '09171234567' : 'Bank account number'}
                className="mt-2 w-full px-3 py-2 rounded-xl border text-sm"
                style={{ borderColor: '#E2E8F0' }}
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Beneficiary name</span>
              <input
                value={beneficiaryName}
                onChange={(e) => setBeneficiaryName(e.target.value)}
                placeholder="Juan Dela Cruz"
                className="mt-2 w-full px-3 py-2 rounded-xl border text-sm"
                style={{ borderColor: '#E2E8F0' }}
              />
            </label>
          </div>

          {errorMsg && <p className="text-xs text-red-500 px-1">{errorMsg}</p>}

          <button
            disabled={!canSubmit}
            onClick={handleCreate}
            className="w-full py-3 rounded-2xl font-black text-white disabled:opacity-40 active:scale-[0.98] transition-all"
            style={{ backgroundColor: '#008055', fontFamily: "'Montserrat', sans-serif" }}
          >
            Continue
          </button>
          <p className="text-[11px] text-slate-400 text-center">Min 5 XLM · Powered by PDAX (mock mode in dev)</p>
        </div>
      )}

      {stage === 'send-xlm' && order && (
        <div className="space-y-3">
          <div className="rounded-2xl p-4 bg-white border" style={{ borderColor: '#F1F5F9' }}>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Send XLM to anchor</p>
            <p className="font-mono text-xs mt-2 break-all">{order.depositAddress}</p>
            <div className="flex items-center justify-between mt-3">
              <div>
                <p className="text-xs text-slate-400">Memo (required)</p>
                <p className="font-mono text-sm font-bold">{order.memo}</p>
              </div>
              <button onClick={() => handleCopy(order.memo)} className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1" style={{ backgroundColor: '#F0FDFA', color: '#008055' }}>
                {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy memo'}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-3">Amount: <span className="font-bold">{order.amountXlm} XLM</span></p>
          </div>
          <button
            onClick={handleSend}
            className="w-full py-3 rounded-2xl font-black text-white active:scale-[0.98] transition-all"
            style={{ backgroundColor: '#008055', fontFamily: "'Montserrat', sans-serif" }}
          >
            Send XLM from my wallet
          </button>
          <button onClick={() => setStage('form')} className="w-full py-2 text-xs text-slate-500 font-bold">Cancel</button>
        </div>
      )}

      {(stage === 'sending' || stage === 'swapping' || stage === 'paying-out') && (
        <div className="rounded-2xl p-6 bg-white border text-center space-y-3" style={{ borderColor: '#F1F5F9' }}>
          <Loader2 size={32} className="mx-auto animate-spin" style={{ color: '#008055' }} />
          <p className="font-bold text-slate-900">
            {stage === 'sending' && 'Sending XLM…'}
            {stage === 'swapping' && 'Verifying on Stellar & calculating PHP payout…'}
            {stage === 'paying-out' && `Awaiting operator to release PHP via ${latest?.rail ?? rail}`}
          </p>
          <p className="text-xs text-slate-400">
            {stage === 'paying-out'
              ? 'We will push-notify you once operator marks PHP sent. You can close this page.'
              : (latest?.message ?? 'Please keep this page open')}
          </p>
        </div>
      )}

      {stage === 'done' && latest && (
        <div className="rounded-2xl p-6 bg-white border text-center space-y-3" style={{ borderColor: '#F1F5F9' }}>
          <CheckCircle2 size={40} className="mx-auto" style={{ color: '#008055' }} />
          <p className="font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>Cashout complete</p>
          <p className="text-sm text-slate-500">PHP {latest.amountOut ?? '—'} sent to {latest.rail}</p>
          {latest.externalTxId && <p className="text-[11px] font-mono text-slate-400">Ref: {latest.externalTxId}</p>}
          <button onClick={() => navigate('/customer/profile')} className="mt-3 px-6 py-2 rounded-xl font-bold text-white" style={{ backgroundColor: '#008055' }}>Done</button>
        </div>
      )}

      {stage === 'failed' && (
        <div className="rounded-2xl p-6 bg-white border text-center space-y-3" style={{ borderColor: '#FECACA' }}>
          <XCircle size={40} className="mx-auto text-red-500" />
          <p className="font-black text-slate-900">Cashout failed</p>
          <p className="text-xs text-red-500">{errorMsg ?? 'Unknown error'}</p>
          <button onClick={() => { setStage('form'); setOrder(null); setErrorMsg(null); reset(); }} className="mt-3 px-6 py-2 rounded-xl font-bold" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>Try again</button>
        </div>
      )}
    </div>
  );
}
