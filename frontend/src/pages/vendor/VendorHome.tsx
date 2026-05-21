import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, HandCoins, ExternalLink, TrendingUp, ArrowRight, Zap, AlertCircle, RefreshCw, Power, Loader2 } from 'lucide-react';
import { useWallet } from '../../lib/hooks/useWallet';
import { useBalance } from '../../lib/hooks/useBalance';
import { useVendor } from '../../lib/hooks/useVendor';
import { useVendorTransactions, relativeTime } from '../../lib/hooks/useTransactions';
import { useVendorStatus, useToggleVendorStatus } from '../../lib/hooks/useVendorStatus';
import type { TxRecord } from '../../lib/hooks/useTransactions';
import { useToast } from '../../lib/hooks/useToast';
import { truncateAddress, stellarExpertUrl, getServer } from '../../lib/stellar';
import { WalletRequiredState } from '../../components/WalletRequiredState';
import { useLanguage } from '../../contexts/LanguageContext';

function groupByDate(txs: TxRecord[], _lang: 'en' | 'tl', t: (key: string, params?: Record<string, string | number>) => string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const buckets: Record<string, TxRecord[]> = {};
  for (const tx of txs) {
    const d = new Date(tx.createdAt); d.setHours(0, 0, 0, 0);
    const key = d.getTime() === today.getTime()
      ? t('common.today')
      : d.getTime() === yesterday.getTime()
        ? t('common.yesterday')
        : d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(tx);
  }
  return Object.entries(buckets).map(([label, txs]) => ({ label, txs }));
}

const AVATAR_COLORS = ['#14B8A6', '#008055', '#A78BFA', '#FB923C', '#F472B6', '#34D399', '#60A5FA'];

export function VendorHome() {
  const { address } = useWallet();
  const navigate = useNavigate();
  const { vendor, notFound } = useVendor(address);
  const { balance } = useBalance(address);
  const { transactions, isLoading, error, retry, todayEarnings, todayCount } = useVendorTransactions(address);
  const { status: openStatus, refetch: refetchStatus } = useVendorStatus(address);
  const { toggle: toggleStatus, isPending: statusPending } = useToggleVendorStatus(address);
  const { showToast } = useToast();
  const prevCountRef = useRef<number | null>(null);
  const { t, lang } = useLanguage(); // Use global language

  const isOpen = openStatus?.isOpen ?? true;
  const handleToggleStatus = async () => {
    const ok = await toggleStatus(!isOpen);
    if (ok) {
      showToast(!isOpen ? t('vendor.statusToastOpen') : t('vendor.statusToastClosed'), 'success');
      refetchStatus();
    } else {
      showToast(t('vendor.statusError'), 'error');
    }
  };

  useEffect(() => {
    if (address && notFound) navigate('/vendor/apply', { replace: true });
  }, [address, notFound, navigate]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!address) return;
    const server = getServer();
    const close = server.effects().forAccount(address).cursor('now').stream({
      onmessage: (effect: { type: string; amount?: string }) => {
        if (effect.type === 'account_credited') {
          const amt = parseFloat(effect.amount ?? '0').toFixed(2);
          showToast(`Payment received! +${amt} XLM`, 'success');
          if ('Notification' in window && Notification.permission === 'granted') {
            server.transactions().forAccount(address).order('desc').limit(1).call()
              .then(({ records }) => {
                const memo = records[0]?.memo ?? '';
                new Notification('PalengkePay — Payment received!', {
                  body: memo ? `+${amt} XLM · ${memo}` : `+${amt} XLM`,
                  icon: '/favicon.ico',
                  tag: 'payment-received',
                });
              })
              .catch(() => {
                new Notification('PalengkePay — Payment received!', {
                  body: `+${amt} XLM`,
                  icon: '/favicon.ico',
                  tag: 'payment-received',
                });
              });
          }
        }
      },
      onerror: () => {},
    });
    return () => { if (typeof close === 'function') close(); };
  }, [address, showToast]);

  useEffect(() => {
    if (prevCountRef.current === null) { prevCountRef.current = transactions.length; return; }
    if (transactions.length > prevCountRef.current) {
      const newest = transactions[0];
      showToast(`+${newest.amountXlm.toFixed(2)} XLM from ${newest.from.slice(0, 8)}…`, 'success');
    }
    prevCountRef.current = transactions.length;
  }, [transactions, showToast]);

  const h = new Date().getHours();
  const getTimeGreeting = () => {
    if (h < 12) return t('vendor.goodMorning');
    if (h < 18) return t('vendor.goodAfternoon');
    return t('vendor.goodEvening');
  };
  
  const timeGreeting = getTimeGreeting();
  const firstName = vendor?.name?.split(' ')[0] ?? 'Vendor';
  const greetingText = t('vendor.greeting', { name: firstName, time: timeGreeting });
  
  const earnings = todayEarnings();
  const count = todayCount();
  const recent = transactions.slice(0, 10);
  const groups = groupByDate(recent, lang, t);
  const allTimeTotal = transactions.reduce((s, tx) => s + tx.amountXlm, 0);

  const earningsStr = earnings.toFixed(2);
  const earningsFontSize = earningsStr.length >= 10 ? '1.6rem' : earningsStr.length >= 8 ? '2rem' : earningsStr.length >= 6 ? '2.6rem' : '3.2rem';
  const balanceStr = balance ? parseFloat(balance).toFixed(2) : '—';

  if (!address) {
    return <WalletRequiredState detail="Connect your vendor wallet to view earnings, show your QR, and manage installment credit." />;
  }

  return (
    <div className="animate-page-in" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>

      {/* ── EARNINGS HERO ── */}
      <div
        className="relative mx-4 mt-4 rounded-3xl"
        style={{ backgroundColor: '#00284B', overflow: 'clip' }}
      >
        {/* Banig-weave diagonal texture */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage: `repeating-linear-gradient(
              45deg, white 0px, white 1px, transparent 1px, transparent 12px
            ), repeating-linear-gradient(
              -45deg, white 0px, white 1px, transparent 1px, transparent 12px
            )`,
          }}
        />
        {/* Ambient glow */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: -60, right: -60, width: 260, height: 260, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(20,184,166,0.32) 0%, transparent 65%)',
            filter: 'blur(50px)',
          }}
        />
        {/* ₱ watermark */}
        <div
          className="absolute select-none pointer-events-none font-black"
          style={{
            fontSize: '12rem', lineHeight: 1,
            color: 'rgba(255,255,255,0.04)',
            bottom: -20, right: -10,
            fontFamily: "'Montserrat', sans-serif",
          }}
        >₱</div>

        <div className="relative p-5 pb-6">
          {/* Top row: greeting only (language toggle removed - now in navbar) */}
          <div className="flex items-center justify-between mb-4">
            {/* Live greeting pill */}
            <div
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#4ADE80' }} />
              {greetingText}
            </div>
          </div>

          {/* Open / Closed status toggle */}
          <button
            onClick={handleToggleStatus}
            disabled={statusPending}
            className="w-full mb-4 rounded-2xl px-4 py-3 flex items-center justify-between active:scale-[0.98] transition-all disabled:opacity-60"
            style={{
              backgroundColor: isOpen ? 'rgba(34,197,94,0.12)' : 'rgba(244,63,94,0.12)',
              border: `1.5px solid ${isOpen ? 'rgba(34,197,94,0.35)' : 'rgba(244,63,94,0.35)'}`,
            }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{
                  backgroundColor: isOpen ? '#22C55E' : '#F43F5E',
                  boxShadow: `0 0 8px ${isOpen ? '#22C55E' : '#F43F5E'}`,
                  animation: isOpen ? 'pulse 2s infinite' : undefined,
                }}
              />
              <div className="text-left min-w-0">
                <p className="text-sm font-black text-white truncate" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                  {isOpen ? t('vendor.stallOpen') : t('vendor.stallClosed')}
                </p>
                <p className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {isOpen ? t('vendor.tapToClose') : t('vendor.tapToOpen')}
                </p>
              </div>
            </div>
            {statusPending
              ? <Loader2 size={16} className="animate-spin shrink-0" style={{ color: 'rgba(255,255,255,0.6)' }} />
              : <Power size={16} className="shrink-0" style={{ color: isOpen ? '#22C55E' : '#F43F5E' }} />
            }
          </button>

          {/* Earnings */}
          <div className="mb-1">
            <p
              className="text-xs font-bold uppercase tracking-[0.18em] mb-2"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >{t('vendor.todayEarnings')}</p>

            {isLoading
              ? <div className="h-12 w-40 skeleton rounded-xl mb-2" />
              : (
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span
                    className="font-black text-white leading-none"
                    style={{
                      fontSize: earningsFontSize,
                      fontFamily: "'Montserrat', sans-serif",
                      letterSpacing: '-0.02em',
                      lineHeight: 1.05,
                    }}
                  >
                    {earningsStr}
                  </span>
                  <span
                    className="text-base font-bold shrink-0"
                    style={{ color: 'rgba(255,255,255,0.35)', fontFamily: "'Montserrat', sans-serif" }}
                  >XLM</span>
                </div>
              )
            }

            <div className="flex items-center gap-1.5 mt-2">
              <Zap size={11} style={{ color: '#FDE68A' }} />
              <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {t('vendor.paymentsToday', { count: count })}
              </span>
            </div>
          </div>

          {/* Stats row */}
          <div
            className="mt-4 pt-4 grid grid-cols-3 gap-3"
            style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
          >
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('vendor.allTimeEarnings')}</p>
              <p className="text-sm font-black text-white leading-tight truncate" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                {allTimeTotal.toFixed(2)}
              </p>
              <p className="text-xs opacity-40 text-white">XLM</p>
            </div>
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('vendor.totalPayments')}</p>
              <p className="text-sm font-black text-white leading-tight" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                {transactions.length}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('vendor.wallet')}</p>
              <p className="text-sm font-black text-white leading-tight truncate" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                {balanceStr}
              </p>
              <p className="text-xs opacity-40 text-white">XLM</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── SHOW QR — PRIMARY CTA ── */}
      <div className="px-4 mt-3">
        <button
          onClick={() => navigate('/vendor/qr')}
          className="w-full relative overflow-hidden flex items-center gap-4 text-white rounded-3xl transition-all active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #008055 0%, #0D9488 100%)',
            minHeight: '80px',
            padding: '0 20px',
            boxShadow: '0 8px 32px rgba(15,118,110,0.45)',
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none opacity-10"
            style={{
              backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          />
          <div
            className="absolute right-0 top-0 bottom-0 w-32 pointer-events-none"
            style={{ background: 'linear-gradient(to left, rgba(20,184,166,0.4), transparent)' }}
          />
          <div className="relative shrink-0">
            <div
              className="absolute inset-0 rounded-2xl animate-ping opacity-20"
              style={{ backgroundColor: 'rgba(255,255,255,0.4)' }}
            />
            <div
              className="relative rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: 'rgba(255,255,255,0.18)', width: 52, height: 52 }}
            >
              <QrCode size={26} />
            </div>
          </div>
          <div className="relative text-left flex-1 min-w-0">
            <p
              className="font-black text-lg leading-tight"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              {t('vendor.showQR')}
            </p>
            <p className="text-sm mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {t('vendor.showQRSub')}
            </p>
          </div>
          <ArrowRight size={20} style={{ color: 'rgba(255,255,255,0.5)' }} className="shrink-0" />
        </button>
      </div>

      {/* ── UTANG SECONDARY CTA ── */}
      <div className="px-4 mt-3">
        <button
          onClick={() => navigate('/vendor/utang')}
          className="w-full flex items-center gap-4 rounded-2xl transition-all active:scale-95"
          style={{
            backgroundColor: '#FFFBEB',
            border: '2px solid #FDE68A',
            minHeight: '64px',
            padding: '0 16px',
          }}
        >
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: '#FEF3C7' }}
          >
            <HandCoins size={22} style={{ color: '#D97706' }} />
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm font-black text-slate-900 leading-tight" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              {t('vendor.utang')}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{t('vendor.utangSub')}</p>
          </div>
          <ArrowRight size={16} style={{ color: '#D97706' }} className="shrink-0" />
        </button>
      </div>

      {/* ── RECENT PAYMENTS ── */}
      <div className="mx-4 mt-4 bg-white rounded-3xl overflow-hidden" style={{ border: '1.5px solid #F1F5F9' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1.5px solid #F8FAFC' }}>
          <h2
            className="text-base font-black text-slate-900"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            {t('vendor.recentPayments')}
          </h2>
          <button
            onClick={() => navigate('/vendor/transactions')}
            className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full active:scale-95"
            style={{ color: '#008055', backgroundColor: '#F0FDFA' }}
          >
            {t('vendor.viewAll')} <ArrowRight size={11} />
          </button>
        </div>

        <div className="px-3 py-3">
          {isLoading && (
            <div className="space-y-3 p-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl skeleton shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-32 skeleton rounded-lg" />
                    <div className="h-2.5 w-20 skeleton rounded-lg" />
                  </div>
                  <div className="h-5 w-16 skeleton rounded-lg" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && error && (
            <div className="text-center py-10">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{ backgroundColor: '#FFF1F2', border: '1px solid #FECDD3' }}
              >
                <AlertCircle size={22} style={{ color: '#F43F5E' }} />
              </div>
              <p className="text-sm font-bold text-slate-600 mb-1">{t('vendor.loadFailed')}</p>
              <p className="text-xs text-slate-400 mb-4">{error}</p>
              <button
                onClick={retry}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl active:scale-95"
                style={{ color: '#008055', backgroundColor: '#F0FDFA' }}
              >
                <RefreshCw size={12} /> {t('vendor.retry')}
              </button>
            </div>
          )}

          {!isLoading && !error && transactions.length === 0 && (
            <div className="text-center py-12 px-4">
              <div
                className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: '#F0FDFA', border: '2px solid #CCFBF1' }}
              >
                <TrendingUp size={26} style={{ color: '#14B8A6' }} />
              </div>
              <p className="text-base font-black text-slate-700 mb-1" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                {t('vendor.emptyTitle')}
              </p>
              <p className="text-sm text-slate-500 mb-5">{t('vendor.emptyDesc')}</p>
              <button
                onClick={() => navigate('/vendor/qr')}
                className="inline-flex items-center gap-2 text-sm font-bold px-5 py-3 rounded-2xl active:scale-95"
                style={{ color: 'white', backgroundColor: '#008055' }}
              >
                <QrCode size={15} /> {t('vendor.showQRBtn')}
              </button>
            </div>
          )}

          {!isLoading && !error && groups.length > 0 && (
            <div className="space-y-4">
              {groups.map(({ label, txs }) => (
                <div key={label}>
                  <div className="flex items-center gap-2 mb-1 px-2">
                    <span className="flex-1 h-px" style={{ backgroundColor: '#F1F5F9' }} />
                    <span
                      className="text-xs font-bold uppercase tracking-widest px-2"
                      style={{ color: '#94A3B8' }}
                    >
                      {label}
                    </span>
                    <span className="flex-1 h-px" style={{ backgroundColor: '#F1F5F9' }} />
                  </div>
                  <div>
                    {txs.map(tx => {
                      const color = AVATAR_COLORS[tx.from.charCodeAt(0) % AVATAR_COLORS.length];
                      return (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between py-3 px-3 rounded-2xl transition-colors active:bg-slate-50"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div
                              className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shrink-0"
                              style={{ backgroundColor: color + '22', color }}
                            >
                              {tx.from[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-mono text-slate-600 truncate leading-tight">{truncateAddress(tx.from)}</p>
                              {tx.memo && (
                                <p className="text-xs font-semibold truncate mt-0.5" style={{ color: '#008055' }}>{tx.memo}</p>
                              )}
                              <p className="text-xs text-slate-400 mt-0.5">{relativeTime(tx.createdAt)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            <div className="text-right">
                              <span className="text-sm font-black block" style={{ color: '#059669', fontFamily: "'Montserrat', sans-serif" }}>
                                +{tx.amountXlm.toFixed(2)}
                              </span>
                              <span className="text-xs text-slate-400">XLM</span>
                            </div>
                            <a
                              href={stellarExpertUrl(tx.id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg"
                              style={{ color: '#CBD5E1' }}
                            >
                              <ExternalLink size={13} />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}