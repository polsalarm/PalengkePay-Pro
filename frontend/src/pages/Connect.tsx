import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, ShieldCheck, Loader2, Zap } from 'lucide-react';
import { useWallet } from '../lib/hooks/useWallet';

const WALLETS = [
  { id: 'freighter',     letter: 'F', color: '#4F46E5', bg: '#EEF2FF', name: 'Freighter',     sub: 'Browser extension wallet' },
  { id: 'lobstr',        letter: 'L', color: '#0EA5E9', bg: '#F0F9FF', name: 'Lobstr',         sub: 'Mobile wallet' },
  { id: 'xbull',         letter: 'X', color: '#7C3AED', bg: '#F5F3FF', name: 'xBull',          sub: 'Advanced wallet' },
  { id: 'albedo',        letter: 'A', color: '#D97706', bg: '#FFFBEB', name: 'Albedo',          sub: 'Web-based, no install needed' },
  { id: 'walletconnect', letter: 'W', color: '#0F766E', bg: '#F0FDFA', name: 'WalletConnect',   sub: 'Connect mobile wallet' },
];

async function fundWithFriendbot(address: string): Promise<void> {
  const res = await fetch(`https://friendbot.stellar.org/?addr=${encodeURIComponent(address)}`);
  if (!res.ok) throw new Error('Friendbot failed');
}

export function Connect() {
  const { isConnected, connect, isConnecting, address } = useWallet();
  const navigate = useNavigate();
  const [connecting, setConnecting] = useState<string | null>(null);
  const [funding, setFunding] = useState(false);
  const [funded, setFunded] = useState(false);
  const [fundError, setFundError] = useState<string | null>(null);
  const attempted = useRef(false);

  // Only redirect after explicit user click — not on mount
  useEffect(() => {
    if (isConnected && attempted.current) navigate('/onboard');
  }, [isConnected, navigate]);

  const handleWalletClick = async (id: string) => {
    attempted.current = true;
    setConnecting(id);
    await connect();
    setConnecting(null);
  };

  const handleFriendbot = async () => {
    if (!address) return;
    setFunding(true);
    setFundError(null);
    try {
      await fundWithFriendbot(address);
      setFunded(true);
    } catch {
      setFundError('Friendbot failed — already funded or network error');
    } finally {
      setFunding(false);
    }
  };

  return (
    <div className="min-h-screen flex overflow-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── Left panel ─────────────────────────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[42%] shrink-0 p-10 xl:p-14"
        style={{ backgroundColor: '#0A3D38' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white"
            style={{ backgroundColor: 'rgba(255,255,255,0.12)', fontSize: '1.1rem' }}
          >
            ₱
          </div>
          <span className="font-black text-white text-lg" style={{ fontFamily: "'Syne', sans-serif" }}>
            PalengkePay
          </span>
        </div>

        {/* Center content */}
        <div>
          <h2
            className="font-black text-white mb-5 leading-tight"
            style={{ fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', fontFamily: "'Syne', sans-serif" }}
          >
            Step into the<br />digital palengke.
          </h2>
          <p className="text-sm leading-relaxed mb-10" style={{ color: 'rgba(255,255,255,0.5)' }}>
            12,400+ vendors already accept XLM.<br />
            Every transaction settles in 3 seconds.
          </p>

          {/* Testimonial */}
          <div
            className="rounded-2xl p-5"
            style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.8)' }}>
              "Before, I was always short on change. Now they just scan.{' '}
              <span className="font-bold text-white">Faster and safer.</span>"
            </p>
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                style={{ backgroundColor: '#14B8A6', color: 'white' }}
              >
                AN
              </div>
              <div>
                <p className="text-xs font-bold text-white">Aling Nena</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Gulayan · Marikina Public Market</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
          <ShieldCheck size={13} style={{ color: '#4ADE80' }} />
          <span className="text-xs font-medium">Secured by Stellar Testnet</span>
        </div>
      </div>

      {/* ── Right panel ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 lg:px-10 py-5 border-b border-slate-100">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors active:scale-95"
          >
            <ArrowLeft size={15} />
            Back
          </button>
          <div
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold"
            style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B' }}
          >
            <span className="text-slate-900">EN</span>
            <span className="text-slate-300 mx-0.5">·</span>
            <span>TL</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">
            <h1
              className="font-black text-slate-900 mb-2 tracking-tight"
              style={{ fontSize: '2rem', fontFamily: "'Syne', sans-serif" }}
            >
              Connect Your Wallet
            </h1>
            <p className="text-sm text-slate-500 mb-8 leading-relaxed">
              Link your Stellar wallet to start accepting or making payments
            </p>

            {/* Wallet list */}
            <div className="space-y-2.5 mb-8">
              {WALLETS.map(({ id, letter, color, bg, name, sub }) => {
                const isActive = connecting === id;
                return (
                  <button
                    key={id}
                    onClick={() => handleWalletClick(id)}
                    disabled={isConnecting}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition-all active:scale-[0.98] group disabled:opacity-60"
                    style={{ borderColor: '#E2E8F0', backgroundColor: 'white' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = color; e.currentTarget.style.backgroundColor = bg; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.backgroundColor = 'white'; }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 transition-colors"
                      style={{ backgroundColor: bg, color }}
                    >
                      {isActive ? <Loader2 size={16} className="animate-spin" style={{ color }} /> : letter}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900">{name}</p>
                      <p className="text-xs text-slate-400">{sub}</p>
                    </div>
                    <ChevronRight size={16} className="shrink-0 text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </button>
                );
              })}
            </div>

            {/* Friendbot faucet — shown after wallet connected */}
            {isConnected && address && (
              <div
                className="rounded-2xl p-4 mb-6 border"
                style={{ backgroundColor: '#F0FDFA', borderColor: '#CCFBF1' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Zap size={14} style={{ color: '#0F766E' }} />
                  <p className="text-sm font-bold text-slate-800">Get Testnet XLM (Free)</p>
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  Fund your wallet with free testnet XLM via Stellar Friendbot. One-time per account.
                </p>
                {funded ? (
                  <p className="text-xs font-bold" style={{ color: '#0F766E' }}>✓ Wallet funded with 10,000 testnet XLM!</p>
                ) : (
                  <button
                    onClick={handleFriendbot}
                    disabled={funding}
                    className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl transition-all active:scale-95 disabled:opacity-60"
                    style={{ backgroundColor: '#0F766E', color: 'white' }}
                  >
                    {funding ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                    {funding ? 'Funding…' : 'Fund with Friendbot'}
                  </button>
                )}
                {fundError && <p className="text-xs text-red-500 mt-2">{fundError}</p>}
              </div>
            )}

            {/* No wallet CTA */}
            <div className="text-center">
              <p className="text-xs text-slate-400">Don't have a wallet yet?</p>
              <button
                onClick={() => navigate('/onboard')}
                className="text-xs font-semibold hover:underline transition-colors"
                style={{ color: '#0F766E' }}
              >
                Get started with Freighter →
              </button>
            </div>
          </div>
        </div>

        {/* Mobile footer */}
        <div className="lg:hidden px-6 pb-6 flex items-center justify-center gap-2 text-xs text-slate-400">
          <ShieldCheck size={12} className="text-green-500" />
          Secured by Stellar Testnet
        </div>
      </div>
    </div>
  );
}
