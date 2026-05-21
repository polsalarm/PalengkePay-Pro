import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { ArrowLeft, ArrowUpFromLine, Copy, Check, Loader2, CheckCircle2, XCircle, Calculator, QrCode } from 'lucide-react';
import { useWallet } from '../../lib/hooks/useWallet';
import { usePhpRate } from '../../lib/hooks/usePhpRate';
import { quoteCashin, previewCashinQuote, confirmCashin, getStatus, isTerminal, type CashinQuoteResult, type RampTxn } from '../../lib/ramp';
import { notifyWallet } from '../../lib/notify';
import { buildCashinQrPayload, encodeCashinQrPayload, quoteSecondsRemaining } from '../../lib/ramp-qr';
import { useLanguage } from '../../contexts/LanguageContext';

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
  const { t } = useLanguage();

  const [amountPhp, setAmountPhp] = useState('');
  const [stage, setStage] = useState<Stage>('form');
  const [quote, setQuote] = useState<CashinQuoteResult | null>(null);
  const [latest, setLatest] = useState<RampTxn | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedQr, setCopiedQr] = useState(false);
  const [senderName, setSenderName] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [proofConfirmed, setProofConfirmed] = useState(false);
  const [preview, setPreview] = useState<CashinQuoteResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const phpNum = Number(amountPhp) || 0;
  const estXlm = phpPerXlm && phpPerXlm > 0 ? (phpNum / phpPerXlm).toFixed(4) : null;
  const canSubmit = address && phpNum >= 50;
  const activeQuote = quote ?? preview;
  const qrPayload = quote ? buildCashinQrPayload(quote, latest?.network ?? 'testnet') : null;
  const qrValue = qrPayload ? encodeCashinQrPayload(qrPayload) : '';

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
      const r = await confirmCashin({
        id: quote.id,
        reference: paymentReference.trim() || quote.proofReference || quote.instructions.reference,
        proofReference: quote.proofReference ?? quote.instructions.reference,
        operatorNote: senderName.trim() ? `Sender: ${senderName.trim()}` : undefined,
      });
      setStage(stageFromStatus(r.status));
      if (address) notifyWallet(address, {
        title: t('cashin.notificationTitle'),
        body: r.status === 'completed' ? t('cashin.notificationBodyComplete') : t('cashin.notificationBodyWaiting'),
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
      const txn = await getStatus(quote.id);
      if (!txn) return;
      setLatest(txn);
      const next = stageFromStatus(txn.status);
      setStage(next);
      if (isTerminal(txn.status)) clearInterval(interval);
    }, 4000);
    return () => clearInterval(interval);
  }, [quote, stage]);

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (stage !== 'form') return;
    if (!Number.isFinite(phpNum) || phpNum < 50) {
      setPreview(null);
      setPreviewLoading(false);
      return;
    }
    setPreviewLoading(true);
    const timeout = setTimeout(() => {
      previewCashinQuote({ amountPhp: phpNum.toFixed(2) })
        .then(setPreview)
        .catch(() => setPreview(null))
        .finally(() => setPreviewLoading(false));
    }, 350);
    return () => {
      clearTimeout(timeout);
    };
  }, [phpNum, stage]);

  const handleCopy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* noop */ }
  };

  const handleCopyQr = async () => {
    if (!qrValue) return;
    try {
      await navigator.clipboard.writeText(qrValue);
      setCopiedQr(true);
      setTimeout(() => setCopiedQr(false), 1500);
    } catch { /* noop */ }
  };

  return (
    <div className="space-y-4 animate-page-in max-w-md">
      <button onClick={() => navigate('/customer/profile')} className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
        <ArrowLeft size={14} /> {t('common.back')}
      </button>

      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#F0FDFA' }}>
          <ArrowUpFromLine size={20} style={{ color: '#008055' }} />
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>{t('cashin.title')}</h1>
          <p className="text-xs text-slate-400">{t('cashin.subtitle')}</p>
        </div>
      </div>

      {stage === 'form' && (
        <div className="space-y-3">
          <div className="rounded-2xl p-4 bg-white border" style={{ borderColor: '#F1F5F9' }}>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">{t('cashin.amountPhp')}</span>
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
                <span className="text-xs text-slate-400">{t('cashin.minAmount')}</span>
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
            {t('cashin.getQuote')}
          </button>
          <p className="text-[11px] text-slate-400 text-center">{t('cashin.poweredBy')}</p>
        </div>
      )}

      {stage === 'pay-php' && quote && (
        <div className="space-y-3">
          <div className="rounded-2xl p-4 bg-white border space-y-3" style={{ borderColor: '#F1F5F9' }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">{t('cashin.youPay')}</span>
              <span className="font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>PHP {quote.amountPhp}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">{t('cashin.youReceive')}</span>
              <span className="font-black" style={{ color: '#008055', fontFamily: "'Montserrat', sans-serif" }}>{quote.amountXlm} XLM</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">{t('cashin.rate')}</span>
              <span className="text-xs text-slate-500">1 XLM = PHP {quote.rate}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">{t('cashin.feeSpread')}</span>
              <span className="text-xs text-slate-500">PHP {quote.feePhp ?? '0.00'} · {quote.spreadBps ?? 0} bps</span>
            </div>
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#008055' }}>
              {quote.railMode === 'partner_api' ? t('cashin.partnerApiMode') : quote.railMode === 'manual_operator' ? t('cashin.manualOperatorMode') : t('cashin.demoSettlementMode')}
            </p>
          </div>

          <div className="rounded-2xl p-4 bg-white border space-y-3" style={{ borderColor: '#F1F5F9' }}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Calculator size={16} style={{ color: '#008055' }} />
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{t('cashin.rateSimulator')}</p>
              </div>
              {previewLoading && <Loader2 size={14} className="animate-spin text-slate-400" />}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Metric label={t('cashin.grossPhp')} value={`PHP ${phpNum > 0 ? phpNum.toFixed(2) : '0.00'}`} />
              <Metric label={t('cashin.fee')} value={`PHP ${activeQuote?.feePhp ?? '0.00'}`} />
              <Metric label={t('cashin.spread')} value={`${activeQuote?.spreadBps ?? 85} bps`} />
              <Metric label={t('cashin.estXlm')} value={activeQuote?.amountXlm ? `${activeQuote.amountXlm} XLM` : (estXlm ? `${estXlm} XLM` : '—')} />
            </div>
            <p className="text-[11px] text-slate-400">
              {t('cashin.quoteHint', { seconds: activeQuote ? `${quoteSecondsRemaining(activeQuote.expiresAt, nowMs)}s` : '60s' })}
            </p>
          </div>

          <div className="rounded-2xl p-4 bg-white border space-y-2" style={{ borderColor: '#F1F5F9' }}>
            <div className="flex items-center gap-2">
              <QrCode size={16} style={{ color: '#008055' }} />
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{t('cashin.qrInstruction')}</p>
            </div>
            <div className="flex justify-center py-2">
              <div className="rounded-2xl border p-3" style={{ borderColor: '#E2E8F0' }}>
                <QRCodeCanvas value={qrValue} size={168} includeMargin />
              </div>
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{t('cashin.payVia', { rail: quote.instructions.rail })}</p>
            <p className="text-xs text-slate-500">{t('cashin.sendInstruction', { amount: quote.amountPhp })}</p>
            <div className="flex items-center justify-between rounded-xl px-3 py-2" style={{ backgroundColor: '#F8FAFC' }}>
              <span className="font-mono text-sm font-bold">{quote.instructions.reference}</span>
              <button onClick={() => handleCopy(quote.instructions.reference)} className="px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1" style={{ backgroundColor: '#F0FDFA', color: '#008055' }}>
                {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? t('cashin.copied') : t('cashin.copy')}
              </button>
            </div>
            <button onClick={handleCopyQr} className="w-full min-h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-1" style={{ backgroundColor: '#F0FDFA', color: '#008055' }}>
              {copiedQr ? <Check size={12} /> : <Copy size={12} />} {copiedQr ? t('cashin.qrCopied') : t('cashin.copyQrPayload')}
            </button>
            <p className="text-[11px] text-slate-400">{t('cashin.expiresIn', { seconds: quoteSecondsRemaining(quote.expiresAt, nowMs), time: new Date(quote.expiresAt).toLocaleTimeString() })}</p>
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#008055' }}>{t('cashin.demoModeNotice')}</p>
          </div>

          <div className="rounded-2xl p-4 bg-white border space-y-3" style={{ borderColor: '#F1F5F9' }}>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{t('cashin.paymentProof')}</p>
            <input
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder={t('cashin.senderNamePlaceholder')}
              className="w-full px-3 py-2 rounded-xl border text-sm"
              style={{ borderColor: '#E2E8F0' }}
            />
            <input
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder={t('cashin.referencePlaceholder')}
              className="w-full px-3 py-2 rounded-xl border text-sm"
              style={{ borderColor: '#E2E8F0' }}
            />
            <label className="flex items-start gap-2 text-xs text-slate-500">
              <input
                type="checkbox"
                checked={proofConfirmed}
                onChange={(e) => setProofConfirmed(e.target.checked)}
                className="mt-0.5"
              />
              {t('cashin.confirmationCheckbox')}
            </label>
          </div>

          <button
            onClick={handleConfirm}
            disabled={!proofConfirmed}
            className="w-full py-3 rounded-2xl font-black text-white active:scale-[0.98] transition-all disabled:opacity-40"
            style={{ backgroundColor: '#008055', fontFamily: "'Montserrat', sans-serif" }}
          >
            {t('cashin.proceedButton')}
          </button>
          <button onClick={() => setStage('form')} className="w-full py-2 text-xs text-slate-500 font-bold">{t('cashin.cancel')}</button>
        </div>
      )}

      {(stage === 'confirming' || stage === 'awaiting-operator' || stage === 'withdrawing') && (
        <div className="rounded-2xl p-6 bg-white border text-center space-y-3" style={{ borderColor: '#F1F5F9' }}>
          <Loader2 size={32} className="mx-auto animate-spin" style={{ color: '#008055' }} />
          <p className="font-bold text-slate-900">
            {stage === 'confirming' && t('cashin.submittingClaim')}
            {stage === 'awaiting-operator' && t('cashin.waitingOperator')}
            {stage === 'withdrawing' && t('cashin.sendingXlm')}
          </p>
          <p className="text-xs text-slate-400">
            {stage === 'awaiting-operator'
              ? t('cashin.operatorWaitMessage')
              : (latest?.message ?? t('cashin.keepPageOpen'))}
          </p>
        </div>
      )}

      {stage === 'done' && latest && (
        <div className="rounded-2xl p-6 bg-white border text-center space-y-3" style={{ borderColor: '#F1F5F9' }}>
          <CheckCircle2 size={40} className="mx-auto" style={{ color: '#008055' }} />
          <p className="font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>{t('cashin.completeTitle')}</p>
          <p className="text-sm text-slate-500">{latest.amountOut ?? '—'} XLM {t('cashin.inYourWallet')}</p>
          <button onClick={() => navigate('/customer/profile')} className="mt-3 px-6 py-2 rounded-xl font-bold text-white" style={{ backgroundColor: '#008055' }}>{t('cashin.done')}</button>
        </div>
      )}

      {stage === 'failed' && (
        <div className="rounded-2xl p-6 bg-white border text-center space-y-3" style={{ borderColor: '#FECACA' }}>
          <XCircle size={40} className="mx-auto text-red-500" />
          <p className="font-black text-slate-900">{t('cashin.failedTitle')}</p>
          <p className="text-xs text-red-500">{errorMsg ?? t('cashin.unknownError')}</p>
          <button onClick={() => { setStage('form'); setQuote(null); setErrorMsg(null); }} className="mt-3 px-6 py-2 rounded-xl font-bold" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>{t('cashin.tryAgain')}</button>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl px-3 py-2" style={{ backgroundColor: '#F8FAFC' }}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-0.5 font-bold text-slate-800">{value}</p>
    </div>
  );
}