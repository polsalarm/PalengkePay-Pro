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
import { useLanguage } from '../../contexts/LanguageContext';

type Stage = 'form' | 'send-xlm' | 'sending' | 'swapping' | 'paying-out' | 'done' | 'failed';

export function CustomerCashout() {
  const navigate = useNavigate();
  const { address } = useWallet();
  const { balance } = useBalance(address);
  const { rate: phpPerXlm } = usePhpRate();
  const { status: payStatus, txHash, error: payError, sendPayment, reset } = usePayment();
  const { t } = useLanguage();

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
            title: r.status === 'completed' ? t('cashout.notificationComplete') : t('cashout.notificationPaying'),
            body: r.status === 'completed' ? t('cashout.notificationBodyComplete', { amount: r.amountOut ?? '—', rail }) : t('cashout.notificationBodyPaying'),
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
  }, [payStatus, txHash, payError, stage, order, address, rail, t]);

  useEffect(() => {
    if (!order || stage !== 'paying-out') return;
    const interval = setInterval(async () => {
      const txn = await getStatus(order.id);
      if (!txn) return;
      setLatest(txn);
      if (isTerminal(txn.status)) {
        clearInterval(interval);
        setStage(txn.status === 'completed' ? 'done' : 'failed');
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
        <ArrowLeft size={14} /> {t('common.back')}
      </button>

      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#F0FDFA' }}>
          <ArrowDownToLine size={20} style={{ color: '#008055' }} />
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>{t('cashout.title')}</h1>
          <p className="text-xs text-slate-400">{t('cashout.subtitle')}</p>
        </div>
      </div>

      {stage === 'form' && (
        <div className="space-y-3">
          <div className="rounded-2xl p-4 bg-white border" style={{ borderColor: '#F1F5F9' }}>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">{t('cashout.amountXlm')}</span>
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
                <span className="text-xs text-slate-400">{t('cashout.balance', { balance: balance ?? '—' })}</span>
                {estPhp && <span className="text-xs font-bold" style={{ color: '#008055' }}>≈ PHP {estPhp}</span>}
              </div>
            </label>
          </div>

          <div className="rounded-2xl p-4 bg-white border space-y-3" style={{ borderColor: '#F1F5F9' }}>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">{t('cashout.payoutMethod')}</span>
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
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">{t('cashout.accountNumber')}</span>
              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder={rail === 'EWALLET' ? t('cashout.ewalletPlaceholder') : t('cashout.bankPlaceholder')}
                className="mt-2 w-full px-3 py-2 rounded-xl border text-sm"
                style={{ borderColor: '#E2E8F0' }}
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">{t('cashout.beneficiaryName')}</span>
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
            {t('cashout.continue')}
          </button>
          <p className="text-[11px] text-slate-400 text-center">{t('cashout.footerNote')}</p>
        </div>
      )}

      {stage === 'send-xlm' && order && (
        <div className="space-y-3">
          <div className="rounded-2xl p-4 bg-white border" style={{ borderColor: '#F1F5F9' }}>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{t('cashout.sendXlmToAnchor')}</p>
            <p className="font-mono text-xs mt-2 break-all">{order.depositAddress}</p>
            <p className="text-[11px] font-bold uppercase tracking-widest mt-3" style={{ color: '#008055' }}>
              {order.railMode === 'partner_api' ? t('cashout.partnerApiMode') : order.railMode === 'manual_operator' ? t('cashout.manualOperatorMode') : t('cashout.demoSettlementMode')} · {order.network ?? 'testnet'}
            </p>
            <div className="flex items-center justify-between mt-3">
              <div>
                <p className="text-xs text-slate-400">{t('cashout.memoRequired')}</p>
                <p className="font-mono text-sm font-bold">{order.memo}</p>
              </div>
              <button onClick={() => handleCopy(order.memo)} className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1" style={{ backgroundColor: '#F0FDFA', color: '#008055' }}>
                {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? t('cashout.copied') : t('cashout.copyMemo')}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-3">{t('cashout.amountLabel')} <span className="font-bold">{order.amountXlm} XLM</span></p>
            <p className="text-[11px] text-slate-400 mt-1">{t('cashout.settlementNote', { spread: order.spreadBps ?? 0 })}</p>
          </div>
          <button
            onClick={handleSend}
            className="w-full py-3 rounded-2xl font-black text-white active:scale-[0.98] transition-all"
            style={{ backgroundColor: '#008055', fontFamily: "'Montserrat', sans-serif" }}
          >
            {t('cashout.sendXlmButton')}
          </button>
          <button onClick={() => setStage('form')} className="w-full py-2 text-xs text-slate-500 font-bold">{t('cashout.cancel')}</button>
        </div>
      )}

      {(stage === 'sending' || stage === 'swapping' || stage === 'paying-out') && (
        <div className="rounded-2xl p-6 bg-white border text-center space-y-3" style={{ borderColor: '#F1F5F9' }}>
          <Loader2 size={32} className="mx-auto animate-spin" style={{ color: '#008055' }} />
          <p className="font-bold text-slate-900">
            {stage === 'sending' && t('cashout.sendingXlm')}
            {stage === 'swapping' && t('cashout.verifyingAndCalculating')}
            {stage === 'paying-out' && t('cashout.awaitingOperator', { rail: latest?.rail ?? rail })}
          </p>
          <p className="text-xs text-slate-400">
            {stage === 'paying-out'
              ? t('cashout.operatorWaitMessage')
              : (latest?.message ?? t('cashout.keepPageOpen'))}
          </p>
        </div>
      )}

      {stage === 'done' && latest && (
        <div className="rounded-2xl p-6 bg-white border text-center space-y-3" style={{ borderColor: '#F1F5F9' }}>
          <CheckCircle2 size={40} className="mx-auto" style={{ color: '#008055' }} />
          <p className="font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>{t('cashout.completeTitle')}</p>
          <p className="text-sm text-slate-500">{t('cashout.sentToRail', { amount: latest.amountOut ?? '—', rail: latest.rail ?? '—' })}</p>
          {latest.externalTxId && <p className="text-[11px] font-mono text-slate-400">{t('cashout.reference')}: {latest.externalTxId}</p>}
          <button onClick={() => navigate('/customer/profile')} className="mt-3 px-6 py-2 rounded-xl font-bold text-white" style={{ backgroundColor: '#008055' }}>{t('cashout.done')}</button>
        </div>
      )}

      {stage === 'failed' && (
        <div className="rounded-2xl p-6 bg-white border text-center space-y-3" style={{ borderColor: '#FECACA' }}>
          <XCircle size={40} className="mx-auto text-red-500" />
          <p className="font-black text-slate-900">{t('cashout.failedTitle')}</p>
          <p className="text-xs text-red-500">{errorMsg ?? t('cashout.unknownError')}</p>
          <button onClick={() => { setStage('form'); setOrder(null); setErrorMsg(null); reset(); }} className="mt-3 px-6 py-2 rounded-xl font-bold" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>{t('cashout.tryAgain')}</button>
        </div>
      )}
    </div>
  );
}