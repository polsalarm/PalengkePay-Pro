import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, Wallet, QrCode, ScanLine,
  Check, Copy, ArrowRight, Loader2, ExternalLink,
} from 'lucide-react';
import { useWallet } from '../lib/hooks/useWallet';
import { useBalance } from '../lib/hooks/useBalance';

const STEPS = ['Get wallet', 'Connect', 'Fund', "Let's go!"];

export function Onboard() {
  const { address, connect, isConnecting, error: walletError } = useWallet();
  const { balance, refetch } = useBalance(address);
  const navigate = useNavigate();

  const [step, setStep]           = useState(0);
  const [copied, setCopied]       = useState(false);
  const [funding, setFunding]     = useState(false);
  const [funded, setFunded]       = useState(false);
  const [fundErr, setFundErr]     = useState<string | null>(null);
  const [justConnected, setJustConnected] = useState(false);

  const handleConnect = async () => {
    try {
      await connect();
      // connect() only resolves if authModal + signMessage both succeeded
      setJustConnected(true);
    } catch {
      // walletError state handled by WalletProvider
    }
  };


  const copyAddress = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fundWallet = async () => {
    if (!address) return;
    setFunding(true);
    setFundErr(null);
    try {
      const res = await fetch(`https://friendbot.stellar.org/?addr=${encodeURIComponent(address)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { detail?: string };
        // Already funded = still a success
        if (!body.detail?.includes('createAccountAlreadyExist')) {
          throw new Error(body.detail ?? 'Friendbot failed');
        }
      }
      await new Promise((r) => setTimeout(r, 2000));
      await refetch();
      setFunded(true);
    } catch (e: unknown) {
      setFundErr((e as Error).message ?? 'Failed to fund wallet');
    } finally {
      setFunding(false);
    }
  };

  const hasBalance = funded || (balance !== null && parseFloat(balance) > 0);
  const truncAddr  = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '';

  // ── Shared: left panel sidebar ──────────────────────────────────────────
  const LeftPanel = () => (
    <div
      className="hidden lg:flex flex-col justify-between w-[42%] shrink-0 p-10 xl:p-14"
      style={{ backgroundColor: '#0A3D38' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white"
          style={{ backgroundColor: 'rgba(255,255,255,0.12)', fontSize: '1.1rem' }}
        >₱</div>
        <span className="font-black text-white text-lg" style={{ fontFamily: "'Syne', sans-serif" }}>
          PalengkePay
        </span>
      </div>

      {/* Step 0: checklist */}
      {step === 0 && (
        <div>
          <h2
            className="font-black text-white mb-4 leading-tight"
            style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontFamily: "'Syne', sans-serif" }}
          >
            Four steps.<br />Three minutes.
          </h2>
          <p className="text-sm mb-8 leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Let's finish your setup. After this, you can start accepting payments.
          </p>
          <div className="space-y-4">
            {[
              { n: 1, label: 'First, get a wallet',  active: true  },
              { n: 2, label: 'Connect your wallet',  active: false },
              { n: 3, label: 'Get free test money',  active: false },
              { n: 4, label: "You're ready!",         active: false },
            ].map(({ n, label, active }) => (
              <div key={n} className="flex items-center gap-3">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all"
                  style={active
                    ? { backgroundColor: '#14B8A6', color: 'white' }
                    : { backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.25)' }}
                >{n}</div>
                <span
                  className="text-sm font-medium transition-all"
                  style={{ color: active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)' }}
                >{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Steps 1-3: testimonial */}
      {step > 0 && (
        <div>
          <h2
            className="font-black text-white mb-4 leading-tight"
            style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontFamily: "'Syne', sans-serif" }}
          >
            Step into the<br />digital palengke.
          </h2>
          <p className="text-sm leading-relaxed mb-8" style={{ color: 'rgba(255,255,255,0.5)' }}>
            12,400+ vendors already accept XLM.<br />Every transaction settles in 3 seconds.
          </p>
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
              >AN</div>
              <div>
                <p className="text-xs font-bold text-white">Aling Nena</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Gulayan · Marikina Public Market</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
        <ShieldCheck size={13} style={{ color: '#4ADE80' }} />
        <span className="text-xs font-medium">Secured by Stellar Testnet</span>
      </div>
    </div>
  );

  // ── Shared: top bar ─────────────────────────────────────────────────────
  const TopBar = () => (
    <div
      className="flex items-center justify-between px-6 lg:px-12 py-4 border-b"
      style={{ borderColor: 'rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-center gap-2.5">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className="h-1 rounded-full transition-all duration-500"
            style={{
              width: i === step ? 28 : 18,
              backgroundColor: i <= step ? '#0F766E' : '#CBD5E1',
              opacity: i > step ? 0.45 : 1,
            }}
          />
        ))}
        <span className="ml-1 text-xs font-semibold text-slate-400">Step {step + 1} of {STEPS.length}</span>
      </div>
      <div
        className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold"
        style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B' }}
      >
        <span className="text-slate-900">EN</span>
        <span className="text-slate-300 mx-0.5">·</span>
        <span>TL</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex overflow-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <LeftPanel />

      {/* ── Right panel ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col" style={{ backgroundColor: '#FAFAF7' }}>
        <TopBar />

        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md" key={step}>

            {/* ── Step 0: Get a wallet ── */}
            {step === 0 && (
              <div>
                <h1
                  className="font-black text-slate-900 mb-2 tracking-tight"
                  style={{ fontSize: '2rem', fontFamily: "'Syne', sans-serif" }}
                >First, get a wallet</h1>
                <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                  A wallet is where your payments go. It takes 2 minutes to set up.
                </p>

                <div className="space-y-3 mb-8">
                  {/* Freighter */}
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm shrink-0"
                      style={{ backgroundColor: '#EEF2FF', color: '#4F46E5' }}
                    >F</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-bold text-slate-900">Freighter</p>
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: '#F0FDFA', color: '#0F766E', border: '1px solid #CCFBF1' }}
                        >Recommended</span>
                      </div>
                      <p className="text-xs text-slate-400">Best for desktop and laptop</p>
                    </div>
                    <a
                      href="https://www.freighter.app/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl text-white transition-all hover:opacity-90 active:scale-95"
                      style={{ backgroundColor: '#0F766E' }}
                    >
                      Install <ExternalLink size={11} />
                    </a>
                  </div>

                  {/* Lobstr */}
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm shrink-0"
                      style={{ backgroundColor: '#F0F9FF', color: '#0EA5E9' }}
                    >L</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 mb-0.5">Lobstr</p>
                      <p className="text-xs text-slate-400">Best for mobile phone users</p>
                    </div>
                    <a
                      href="https://lobstr.co/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all active:scale-95"
                    >
                      Download <ExternalLink size={11} />
                    </a>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setStep(1)}
                    className="text-sm font-semibold transition-colors hover:opacity-80"
                    style={{ color: '#0F766E' }}
                  >
                    I already have a wallet
                  </button>
                  <button
                    onClick={() => setStep(1)}
                    className="flex items-center gap-2 font-bold px-6 py-3 rounded-2xl text-white transition-all hover:opacity-90 active:scale-95"
                    style={{ backgroundColor: '#0F766E' }}
                  >
                    Next <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 1: Connect wallet ── */}
            {step === 1 && (
              <div>
                {/* Link icon */}
                <div
                  className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8"
                  style={{ backgroundColor: '#F0FDFA', border: '2px dashed #99F6E4' }}
                >
                  <svg width="38" height="38" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16 22C17.657 24.343 21.343 24.343 23 22L27 18C28.657 15.657 28.657 12.343 27 10C25.343 7.657 22.029 7.657 20 10L18.5 11.5" stroke="#0F766E" strokeWidth="2.5" strokeLinecap="round"/>
                    <path d="M22 16C20.343 13.657 16.657 13.657 15 16L11 20C9.343 22.343 9.343 25.657 11 28C12.657 30.343 15.971 30.343 18 28L19.5 26.5" stroke="#0F766E" strokeWidth="2.5" strokeLinecap="round"/>
                  </svg>
                </div>

                <h1
                  className="font-black text-slate-900 mb-2 tracking-tight text-center"
                  style={{ fontSize: '2rem', fontFamily: "'Syne', sans-serif" }}
                >Connect your wallet</h1>
                <p className="text-sm text-slate-500 mb-8 leading-relaxed text-center">
                  PalengkePay can see your balance and send payments —<br />
                  but you approve every transaction.
                </p>

                <button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="w-full flex items-center justify-center gap-2.5 font-bold py-4 rounded-2xl text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-60 mb-3"
                  style={{ backgroundColor: '#0F766E', fontSize: '1rem' }}
                >
                  {isConnecting
                    ? <Loader2 size={18} className="animate-spin" />
                    : <Wallet size={18} />}
                  {isConnecting ? 'Connecting…' : 'Connect Wallet'}
                </button>

                <p className="text-xs text-slate-400 text-center mb-4">
                  A wallet picker will appear — select Freighter, then approve in the extension popup.
                </p>

                {walletError && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-700 mb-4">
                    {walletError}
                  </div>
                )}

                {justConnected && address && (
                  <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-3 mb-4">
                    <div className="w-7 h-7 rounded-lg bg-green-500 flex items-center justify-center shrink-0">
                      <Check size={14} className="text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-green-700">Connected</p>
                      <p className="text-xs text-green-600 font-mono truncate">{address}</p>
                    </div>
                  </div>
                )}

                <div className="flex justify-end mt-2">
                  <button
                    onClick={() => setStep(2)}
                    className="flex items-center gap-2 font-bold px-6 py-3 rounded-2xl text-white transition-all hover:opacity-90 active:scale-95"
                    style={{ backgroundColor: '#0F766E' }}
                  >
                    Next <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 2: Fund wallet ── */}
            {step === 2 && (
              <div>
                {/* Coin icon */}
                <div
                  className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8"
                  style={{ backgroundColor: '#F0FDFA', border: '2px dashed #99F6E4' }}
                >
                  <svg width="38" height="38" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="19" cy="19" r="11" stroke="#0F766E" strokeWidth="2.5"/>
                    <path d="M19 10V28" stroke="#0F766E" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M14 14.5C14 14.5 15.5 12 19 12C22.5 12 25 14 25 16.5C25 19 22.5 20 19 20C15.5 20 13 21.5 13 24.5C13 27 15.5 28.5 19 28.5C22.5 28.5 25 26.5 25 26.5" stroke="#0F766E" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>

                <h1
                  className="font-black text-slate-900 mb-2 tracking-tight text-center"
                  style={{ fontSize: '2rem', fontFamily: "'Syne', sans-serif" }}
                >Get free test money</h1>
                <p className="text-sm text-slate-500 mb-6 leading-relaxed text-center">
                  We're on Stellar Testnet — this is play money for testing.<br />Real payments come later.
                </p>

                {address && (
                  <div className="mb-6">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Your address</p>
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-white border border-slate-200">
                      <p className="flex-1 text-xs font-mono text-slate-600 truncate">{address}</p>
                      <button
                        onClick={copyAddress}
                        className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-slate-100"
                        style={{ color: copied ? '#0F766E' : '#94A3B8' }}
                      >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 text-center mt-2">
                      We'll send 10,000 test XLM to your wallet. It's free!
                    </p>
                  </div>
                )}

                {hasBalance ? (
                  <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl p-4 mb-6">
                    <div className="w-9 h-9 rounded-xl bg-green-500 flex items-center justify-center shrink-0">
                      <Check size={18} className="text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-green-700">Funded!</p>
                      <p className="text-xs text-green-600">{balance} XLM received</p>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={fundWallet}
                    disabled={funding || !address}
                    className="w-full flex items-center justify-center gap-2.5 font-bold py-4 rounded-2xl text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-60 mb-2"
                    style={{ backgroundColor: '#0F766E', fontSize: '1rem' }}
                  >
                    {funding ? <Loader2 size={18} className="animate-spin" /> : '💧'}
                    {funding ? 'Funding wallet…' : 'Get Test XLM'}
                  </button>
                )}

                {fundErr && (
                  <p className="text-xs text-rose-600 text-center mb-3">{fundErr}</p>
                )}

                <div className="flex justify-end mt-4">
                  <button
                    onClick={() => setStep(3)}
                    className="flex items-center gap-2 font-bold px-6 py-3 rounded-2xl text-white transition-all hover:opacity-90 active:scale-95"
                    style={{ backgroundColor: '#0F766E' }}
                  >
                    {hasBalance ? 'Continue' : 'Skip for now'} <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 3: Ready ── */}
            {step === 3 && (
              <div>
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
                  style={{ backgroundColor: '#22C55E', boxShadow: '0 8px 32px rgba(34,197,94,0.35)' }}
                >
                  <Check size={36} className="text-white" strokeWidth={3} />
                </div>

                <h1
                  className="font-black text-slate-900 mb-2 tracking-tight text-center"
                  style={{ fontSize: '2rem', fontFamily: "'Syne', sans-serif" }}
                >You're ready!</h1>
                <p className="text-sm text-slate-500 mb-6 text-center leading-relaxed">
                  PalengkePay is set up. Choose your role to get started.
                </p>

                {/* Summary */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6 space-y-0 divide-y divide-slate-100">
                  <div className="flex items-center justify-between pb-3">
                    <span className="text-xs text-slate-400 font-medium">Wallet</span>
                    <span className="text-sm font-mono font-bold text-slate-700">{truncAddr}</span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <span className="text-xs text-slate-400 font-medium">Network</span>
                    <span
                      className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: '#FEF3C7', color: '#D97706' }}
                    >Stellar Testnet</span>
                  </div>
                  {balance && (
                    <div className="flex items-center justify-between pt-3">
                      <span className="text-xs text-slate-400 font-medium">Balance</span>
                      <span className="text-sm font-black text-slate-800">
                        {parseFloat(balance).toLocaleString('en-PH', { minimumFractionDigits: 2 })}{' '}
                        <span className="text-xs text-slate-400 font-medium">XLM</span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Role cards */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => navigate('/vendor/apply')}
                    className="flex flex-col items-start gap-3 p-5 rounded-2xl border-2 bg-white transition-all hover:shadow-md active:scale-95 text-left"
                    style={{ borderColor: '#CCFBF1' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0F766E'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#CCFBF1'; }}
                  >
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#F0FDFA' }}>
                      <QrCode size={22} style={{ color: '#0F766E' }} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900">I'm a Vendor</p>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                        I sell goods at the palengke and want to accept payments
                      </p>
                    </div>
                    <p className="text-xs font-semibold" style={{ color: '#0F766E' }}>e.g. Aling Nena</p>
                  </button>

                  <button
                    onClick={() => navigate('/customer/home')}
                    className="flex flex-col items-start gap-3 p-5 rounded-2xl border-2 bg-white transition-all hover:shadow-md active:scale-95 text-left"
                    style={{ borderColor: '#E2E8F0' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#94A3B8'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; }}
                  >
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#F8FAFC' }}>
                      <ScanLine size={22} style={{ color: '#475569' }} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900">I'm a Customer</p>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                        I want to scan and pay vendors at the palengke
                      </p>
                    </div>
                    <p className="text-xs font-semibold text-slate-400">e.g. Tatay Boy</p>
                  </button>
                </div>
              </div>
            )}

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
