import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { User, Copy, Check, Store, ExternalLink, ShieldCheck, ArrowDownToLine, ArrowUpFromLine, Send } from 'lucide-react';
import { useWallet } from '../../lib/hooks/useWallet';
import { useBalance } from '../../lib/hooks/useBalance';
import { useFormatAmount } from '../../lib/hooks/useDisplayUnit';
import { UnitToggle } from '../../components/UnitToggle';
import { PrivacyToggle } from '../../components/PrivacyToggle';
import { PushPrompt } from '../../components/PushPrompt';
import { truncateAddress, stellarExpertUrl } from '../../lib/stellar';

const STRINGS = {
  en: {
    title: 'My Profile',
    sub: 'Manage your account and notifications',
    wallet: 'Wallet',
    balance: 'Balance',
    copy: 'Copy address',
    copied: 'Copied!',
    explorer: 'View on Stellar Expert',
    notifications: 'Notifications',
    notifDesc: 'Get alerts on utang reminders and receipts',
    market: 'Browse Market',
    marketSub: 'Find vendors near you',
    cashIn: 'Cash In',
    cashInSub: 'PHP → XLM via PDAX',
    cashOut: 'Cash Out',
    cashOutSub: 'XLM → PHP to your bank',
    walletTest: 'Testnet Wallet Check',
    walletTestSub: 'Send small XLM and view proof',
    preferences: 'Display',
    prefDesc: 'Choose how amounts are shown',
    privacy: 'Privacy',
    privacyDesc: 'Hide balance figures from view',
    notConnected: 'Connect your wallet to see your profile',
  },
  tl: {
    title: 'Aking Profile',
    sub: 'I-manage ang account at notifications',
    wallet: 'Wallet',
    balance: 'Balanse',
    copy: 'Kopyahin ang address',
    copied: 'Nakopya!',
    explorer: 'Tingnan sa Stellar Expert',
    notifications: 'Notifications',
    notifDesc: 'Tumanggap ng alerts sa utang at resibo',
    market: 'Tingnan ang Market',
    marketSub: 'Hanapin ang mga vendor',
    cashIn: 'Mag Cash In',
    cashInSub: 'PHP → XLM sa PDAX',
    cashOut: 'Mag Cash Out',
    cashOutSub: 'XLM → PHP papunta sa bangko',
    walletTest: 'Testnet Wallet Check',
    walletTestSub: 'Magpadala ng maliit na XLM',
    preferences: 'Display',
    prefDesc: 'Piliin kung paano ipakita ang halaga',
    privacy: 'Privacy',
    privacyDesc: 'Itago ang balanse',
    notConnected: 'I-connect ang wallet para makita ang profile',
  },
};

export function CustomerProfile() {
  const { address } = useWallet();
  const { balance } = useBalance(address);
  const [lang, setLang] = useState<'en' | 'tl'>('tl');
  const [copied, setCopied] = useState(false);
  const t = STRINGS[lang];

  const { format } = useFormatAmount();
  const balanceNum = balance ? parseFloat(balance) : null;
  const balanceStr = balanceNum !== null ? format(balanceNum, { showSuffix: true }) : '—';

  const handleCopy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard denied */ }
  };

  return (
    <div className="space-y-4 animate-page-in max-w-md">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            {t.title}
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">{t.sub}</p>
        </div>
        <button
          onClick={() => setLang((l) => (l === 'en' ? 'tl' : 'en'))}
          className="shrink-0 text-xs font-bold rounded-full px-2.5 py-1"
          style={{
            backgroundColor: 'rgba(15,118,110,0.1)',
            color: '#008055',
            border: '1px solid rgba(15,118,110,0.2)',
          }}
        >
          {lang === 'en' ? 'TL' : 'EN'}
        </button>
      </div>

      {/* Profile hero */}
      <div className="relative rounded-3xl overflow-hidden" style={{ backgroundColor: '#00284B' }}>
        <div
          className="absolute pointer-events-none"
          style={{
            top: -40, right: -40, width: 200, height: 200, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(20,184,166,0.28) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
        <div className="relative p-6 space-y-4">
          {!address ? (
            <p className="text-sm text-white/70">{t.notConnected}</p>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)' }}
                >
                  <User size={28} style={{ color: '#14B8A6' }} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#14B8A6' }}>
                    {t.wallet}
                  </p>
                  <p className="font-mono text-sm text-white mt-1 truncate">{truncateAddress(address)}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold rounded-xl py-2.5 active:scale-95 transition-all"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.85)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? t.copied : t.copy}
                </button>
                <a
                  href={stellarExpertUrl(address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold rounded-xl py-2.5 active:scale-95 transition-all"
                  style={{
                    backgroundColor: 'rgba(20,184,166,0.15)',
                    color: '#14B8A6',
                    border: '1px solid rgba(20,184,166,0.25)',
                  }}
                >
                  <ExternalLink size={13} />
                  {t.explorer}
                </a>
              </div>

              <div
                className="rounded-2xl px-4 py-3 flex items-center justify-between"
                style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {t.balance}
                </p>
                <p className="font-black text-white" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                  {balanceStr}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Notifications */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <ShieldCheck size={14} style={{ color: '#008055' }} />
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{t.notifications}</p>
        </div>
        <p className="text-xs text-slate-400 px-1">{t.notifDesc}</p>
        <PushPrompt role="customer" wallet={address} />
      </div>

      {/* Display preferences */}
      <div
        className="rounded-2xl px-5 py-4 space-y-3"
        style={{ backgroundColor: 'white', border: '1.5px solid #F1F5F9' }}
      >
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">{t.preferences}</p>
            <p className="text-xs text-slate-400 mt-0.5">{t.prefDesc}</p>
          </div>
          <UnitToggle variant="light" />
        </div>
        <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid #F1F5F9' }}>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">{t.privacy}</p>
            <p className="text-xs text-slate-400 mt-0.5">{t.privacyDesc}</p>
          </div>
          <PrivacyToggle variant="light" />
        </div>
      </div>

      {/* Cash in / out */}
      <div className="grid grid-cols-2 gap-2">
        <NavLink
          to="/customer/cashin"
          className="rounded-2xl px-4 py-4 flex flex-col items-start gap-2 active:scale-[0.98] transition-all"
          style={{ backgroundColor: 'white', border: '1.5px solid #F1F5F9' }}
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#F0FDFA' }}>
            <ArrowUpFromLine size={16} style={{ color: '#008055' }} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">{t.cashIn}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{t.cashInSub}</p>
          </div>
        </NavLink>
        <NavLink
          to="/customer/cashout"
          className="rounded-2xl px-4 py-4 flex flex-col items-start gap-2 active:scale-[0.98] transition-all"
          style={{ backgroundColor: 'white', border: '1.5px solid #F1F5F9' }}
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#F0FDFA' }}>
            <ArrowDownToLine size={16} style={{ color: '#008055' }} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">{t.cashOut}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{t.cashOutSub}</p>
          </div>
        </NavLink>
      </div>

      <NavLink
        to="/customer/testnet-wallet"
        className="rounded-2xl px-5 py-4 flex items-center gap-4 active:scale-[0.98] transition-all"
        style={{ backgroundColor: 'white', border: '1.5px solid #F1F5F9' }}
      >
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#F0FDFA' }}>
          <Send size={18} style={{ color: '#008055' }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900">{t.walletTest}</p>
          <p className="text-xs text-slate-400 mt-0.5">{t.walletTestSub}</p>
        </div>
        <ExternalLink size={14} className="shrink-0 text-slate-300" />
      </NavLink>

      {/* Browse market */}
      <NavLink
        to="/market"
        className="rounded-2xl px-5 py-4 flex items-center gap-4 active:scale-[0.98] transition-all"
        style={{ backgroundColor: 'white', border: '1.5px solid #F1F5F9' }}
      >
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: '#F0FDFA' }}
        >
          <Store size={20} style={{ color: '#008055' }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900">{t.market}</p>
          <p className="text-xs text-slate-400 mt-0.5">{t.marketSub}</p>
        </div>
        <ExternalLink size={14} className="shrink-0 text-slate-300" />
      </NavLink>
    </div>
  );
}
