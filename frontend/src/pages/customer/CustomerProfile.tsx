import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom'; // Add this import
import { NavLink, useNavigate } from 'react-router-dom';
import {
  User,
  Copy,
  Check,
  Store,
  ExternalLink,
  ShieldCheck,
  ArrowDownToLine,
  ArrowUpFromLine,
  Send,
  ChevronRight,
  LogOut,
  Loader2,
} from 'lucide-react';

import { useWallet } from '../../lib/hooks/useWallet';
import { useBalance } from '../../lib/hooks/useBalance';
import { useFormatAmount } from '../../lib/hooks/useDisplayUnit';

import { UnitToggle } from '../../components/UnitToggle';
import { PrivacyToggle } from '../../components/PrivacyToggle';
import { PushPrompt } from '../../components/PushPrompt';

import { truncateAddress, stellarExpertUrl } from '../../lib/stellar';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../lib/hooks/useToast';

export function CustomerProfile() {
  const navigate = useNavigate();

  const { address, disconnect } = useWallet();

  const { balance } = useBalance(address);

  const { t } = useLanguage();

  const { showToast } = useToast();

  const [copied, setCopied] = useState(false);

  const [showDisconnectModal, setShowDisconnectModal] =
    useState(false);

  const [isDisconnecting, setIsDisconnecting] =
    useState(false);

  const { format } = useFormatAmount();

  const balanceNum = balance ? parseFloat(balance) : null;

  const balanceStr =
    balanceNum !== null
      ? format(balanceNum, { showSuffix: true })
      : '—';

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showDisconnectModal) {
      // Save current scroll position
      const scrollY = window.scrollY;
      
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
    } else {
      // Restore scroll position
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0', 10) * -1);
      }
    }

    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
    };
  }, [showDisconnectModal]);

  const handleCopy = async () => {
    if (!address) return;

    try {
      await navigator.clipboard.writeText(address);

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 1600);
    } catch { /* clipboard write rejected — no-op */ }
  };

  const handleDisconnectConfirm = async () => {
    setIsDisconnecting(true);

    await disconnect();

    setIsDisconnecting(false);

    setShowDisconnectModal(false);

    showToast(t('profile.disconnected'), 'success');

    navigate('/');
  };

  return (
    <>
      <div className="max-w-md mx-auto space-y-4 animate-page-in pb-8">

        {/* HERO */}
        <div
          className="relative overflow-hidden rounded-[28px] p-5"
          style={{
            background:
              'linear-gradient(145deg, #00284B 0%, #003A68 100%)',
          }}
        >
          {/* glow */}
          <div
            className="absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl"
            style={{
              background: 'rgba(20,184,166,0.18)',
            }}
          />

          {!address ? (
            <p className="text-sm text-white/70">
              {t('profile.notConnected')}
            </p>
          ) : (
            <div className="relative z-10 space-y-5">

              {/* TOP */}
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <User size={24} style={{ color: '#008055' }} />
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className="text-[11px] uppercase tracking-[0.22em] font-bold"
                    style={{ color: '#008055' }}
                  >
                    {t('profile.wallet')}
                  </p>

                  <div className="flex items-center gap-2 mt-1">
                    <p className="font-mono text-sm text-white truncate">
                      {truncateAddress(address)}
                    </p>

                    <button
                      onClick={handleCopy}
                      className="shrink-0 active:scale-90 transition"
                    >
                      {copied ? (
                        <Check
                          size={15}
                          className="text-emerald-300"
                        />
                      ) : (
                        <Copy
                          size={15}
                          className="text-white/50 hover:text-white"
                        />
                      )}
                    </button>
                  </div>
                </div>

                {/* LOGOUT BUTTON */}
                <button
                  onClick={() =>
                    setShowDisconnectModal(true)
                  }
                  className="p-2 rounded-xl transition-all active:scale-95 shrink-0"
                  style={{
                    backgroundColor:
                      'rgba(255,255,255,0.08)',
                  }}
                  aria-label={t('profile.disconnect')}
                >
                  <LogOut
                    size={14}
                    style={{
                      color: 'rgba(255,255,255,0.5)',
                    }}
                  />
                </button>
              </div>

              {/* BALANCE */}
              <div
                className="rounded-2xl px-4 py-4"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <p className="text-xs text-white/50 font-medium">
                  {t('profile.balance')}
                </p>

                <div className="mt-2 space-y-3">
                  <h2
                    className="text-3xl font-black text-white tracking-tight break-all"
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                    }}
                  >
                    {balanceStr}
                  </h2>

                  <a
                    href={stellarExpertUrl(address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all active:scale-95"
                    style={{
                      backgroundColor:
                        'rgba(20,184,166,0.14)',
                      color: '#ffffff',
                      border:
                        '1px solid rgba(20,184,166,0.18)',
                      width: 'fit-content',
                    }}
                  >
                    <span>{t('profile.explorer')}</span>

                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>

              {/* QUICK ACTIONS */}
              <div className="grid grid-cols-2 gap-3">
                <NavLink
                  to="/customer/cashin"
                  className="rounded-2xl p-4 active:scale-[0.98] transition"
                  style={{
                    background:
                      'rgba(255,255,255,0.08)',
                    border:
                      '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: '#008055' }}
                  >
                    <ArrowUpFromLine
                      size={16}
                      className="text-white"
                    />
                  </div>

                  <p className="text-sm font-bold text-white mt-3">
                    {t('profile.cashIn')}
                  </p>

                  <p className="text-[11px] text-white/50 mt-0.5">
                    {t('profile.cashInSub')}
                  </p>
                </NavLink>

                <NavLink
                  to="/customer/cashout"
                  className="rounded-2xl p-4 active:scale-[0.98] transition"
                  style={{
                    background:
                      'rgba(255,255,255,0.08)',
                    border:
                      '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: '#008055' }}
                  >
                    <ArrowDownToLine
                      size={16}
                      className="text-white"
                    />
                  </div>

                  <p className="text-sm font-bold text-white mt-3">
                    {t('profile.cashOut')}
                  </p>

                  <p className="text-[11px] text-white/50 mt-0.5">
                    {t('profile.cashOutSub')}
                  </p>
                </NavLink>
              </div>
            </div>
          )}
        </div>

        {/* SETTINGS */}
        <div
          className="rounded-3xl overflow-hidden"
          style={{
            backgroundColor: 'white',
            border: '1px solid #EEF2F7',
          }}
        >
          <div className="px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-900">
                {t('profile.preferences')}
              </p>

              <p className="text-xs text-slate-400 mt-0.5">
                {t('profile.prefDesc')}
              </p>
            </div>

            <UnitToggle variant="light" />
          </div>

          <div className="h-px bg-slate-100" />

          <div className="px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-900">
                {t('profile.privacy')}
              </p>

              <p className="text-xs text-slate-400 mt-0.5">
                {t('profile.privacyDesc')}
              </p>
            </div>

            <PrivacyToggle variant="light" />
          </div>
        </div>

        {/* NOTIFICATIONS */}
        <div
          className="rounded-3xl p-5"
          style={{
            backgroundColor: 'white',
            border: '1px solid #EEF2F7',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck
              size={15}
              style={{ color: '#008055' }}
            />

            <p className="text-sm font-bold text-slate-900">
              {t('profile.notifications')}
            </p>
          </div>

          <p className="text-xs text-slate-400 mb-4">
            {t('profile.notifDesc')}
          </p>

          <PushPrompt role="customer" wallet={address} />
        </div>

        {/* LINKS */}
        <div className="space-y-3">
          <NavLink
            to="/customer/testnet-wallet"
            className="rounded-2xl px-5 py-4 flex items-center gap-4 active:scale-[0.98] transition-all"
            style={{
              backgroundColor: 'white',
              border: '1px solid #EEF2F7',
            }}
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: '#F0FDFA' }}
            >
              <Send
                size={18}
                style={{ color: '#008055' }}
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900">
                {t('profile.walletTest')}
              </p>

              <p className="text-xs text-slate-400 mt-0.5">
                {t('profile.walletTestSub')}
              </p>
            </div>

            <ChevronRight
              size={18}
              className="text-slate-300 shrink-0"
            />
          </NavLink>

          <NavLink
            to="/market"
            className="rounded-2xl px-5 py-4 flex items-center gap-4 active:scale-[0.98] transition-all"
            style={{
              backgroundColor: 'white',
              border: '1px solid #EEF2F7',
            }}
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: '#F0FDFA' }}
            >
              <Store
                size={18}
                style={{ color: '#008055' }}
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900">
                {t('profile.market')}
              </p>

              <p className="text-xs text-slate-400 mt-0.5">
                {t('profile.marketSub')}
              </p>
            </div>

            <ChevronRight
              size={18}
              className="text-slate-300 shrink-0"
            />
          </NavLink>
        </div>
      </div>

      {/* DISCONNECT MODAL - RENDERED WITH PORTAL */}
      {showDisconnectModal && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{
            backgroundColor: 'rgba(0,0,0,0.72)',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() =>
            !isDisconnecting &&
            setShowDisconnectModal(false)
          }
        >
          <div
            className="relative w-full max-w-sm rounded-3xl overflow-hidden animate-scale-in"
            style={{
              backgroundColor: 'white',
              boxShadow:
                '0 20px 40px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{
                  backgroundColor: '#FEF2F2',
                }}
              >
                <LogOut
                  size={28}
                  style={{ color: '#DC2626' }}
                />
              </div>

              <h3
                className="text-xl font-black text-slate-900 text-center mb-2"
                style={{
                  fontFamily:
                    "'Montserrat', sans-serif",
                }}
              >
                {t('profile.disconnectTitle')}
              </h3>

              <p className="text-sm text-slate-500 text-center leading-relaxed mb-6">
                {t('profile.disconnectMessage')}
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() =>
                    setShowDisconnectModal(false)
                  }
                  disabled={isDisconnecting}
                  className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95"
                  style={{
                    backgroundColor: '#F1F5F9',
                    color: '#475569',
                  }}
                >
                  {t('profile.cancel')}
                </button>

                <button
                  onClick={handleDisconnectConfirm}
                  disabled={isDisconnecting}
                  className="flex-1 py-3 rounded-2xl text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: '#DC2626',
                  }}
                >
                  {isDisconnecting ? (
                    <>
                      <Loader2
                        size={16}
                        className="animate-spin"
                      />

                      <span>
                        {t('profile.disconnecting')}
                      </span>
                    </>
                  ) : (
                    t('profile.disconnectConfirm')
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}