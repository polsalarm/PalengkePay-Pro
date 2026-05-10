import { useNavigate } from 'react-router-dom';
import {
  ScanLine, QrCode, Zap, ShieldCheck, ArrowRight,
  Smartphone, CheckCircle, HandCoins, Star,
} from 'lucide-react';
import { useWallet } from '../lib/hooks/useWallet';
import { isRegisteredVendor } from '../lib/hooks/useVendor';
import phoneImg from '../assets/phone.jpg';

// ── Main component ──────────────────────────────────────────────────────────
export function Landing() {
  const navigate = useNavigate();
  const { address, isConnected, connect } = useWallet();

  const handleVendorClick = async () => {
    let addr = address;
    if (!isConnected || !addr) {
      addr = await connect();
      if (!addr) return;
    }
    const registered = await isRegisteredVendor(addr);
    navigate(registered ? '/vendor/home' : '/vendor/apply');
  };

  const handleCustomerClick = async () => {
    if (!isConnected || !address) {
      const addr = await connect();
      if (!addr) return;
    }
    navigate('/customer/home');
  };

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ backgroundColor: '#FAFAF7' }}>

      {/* ══ NAVBAR ══════════════════════════════════════════════════════════ */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{ backgroundColor: 'rgba(250,250,247,0.92)', backdropFilter: 'blur(16px)', borderColor: 'rgba(0,0,0,0.06)' }}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-14 h-16 flex items-center justify-between gap-6">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm" style={{ backgroundColor: '#0F766E' }}>
              <span className="text-white font-black" style={{ fontSize: '1.1rem' }}>₱</span>
            </div>
            <span className="font-black text-slate-900 text-lg tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
              PalengkePay
            </span>
          </div>

          <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-slate-500">
            <button onClick={handleVendorClick} className="hover:text-slate-900 transition-colors">For Vendors</button>
            <button onClick={handleCustomerClick} className="hover:text-slate-900 transition-colors">For Customers</button>
            <a href="#how-it-works" className="hover:text-slate-900 transition-colors">How it works</a>
            <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => navigate('/connect')}
              className="flex items-center gap-2 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all active:scale-95 shadow-sm hover:opacity-90"
              style={{ backgroundColor: '#0F766E' }}
            >
              <span className="sm:hidden">Get Started</span>
              <span className="hidden sm:inline">Get Started — It's Free</span>
            </button>
          </div>
        </div>
      </header>

      {/* ══ HERO ════════════════════════════════════════════════════════════ */}
      <section
        className="lg:grid lg:grid-cols-[55fr_45fr]"
        style={{ minHeight: 'calc(100vh - 64px)' }}
      >
        {/* ── Left panel — cream ── */}
        <div
          className="relative flex items-center py-20 lg:py-0 overflow-hidden"
          style={{ backgroundColor: '#FAFAF7', overflow: 'hidden' }}
        >
          {/* Dot grid */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, #CBD5E1 1px, transparent 1px)',
              backgroundSize: '28px 28px',
              opacity: 0.25,
            }}
          />
          {/* Content — hugs page center */}
          <div className="relative z-10 w-full max-w-[600px] ml-auto px-6 lg:pr-14 xl:pr-20 lg:pl-4">
            {/* Live badge */}
            <div
              className="inline-flex items-center gap-2 border text-xs font-bold px-3.5 py-1.5 rounded-full mb-8"
              style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', color: '#16A34A' }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#22C55E' }} />
              Live on Stellar Testnet
            </div>

            <h1
              className="font-black text-slate-900 leading-[1.05] tracking-tight mb-6"
              style={{ fontSize: 'clamp(2.8rem, 3.4vw, 4.4rem)', fontFamily: "'Syne', sans-serif" }}
            >
              Digital<br />payments<br />
              <span style={{ color: '#0F766E' }}>para sa</span>{' '}
              <span className="relative inline-block">
                <span className="relative" style={{ zIndex: 1 }}>palengke</span>
                <span
                  className="absolute left-0 right-0 bottom-[0.06em] rounded"
                  style={{ height: '0.32em', backgroundColor: '#FDE68A', zIndex: 0 }}
                />
              </span>
            </h1>

            <p className="text-slate-500 leading-relaxed mb-10 max-w-[430px]" style={{ fontSize: '1.125rem' }}>
              Scan. Pay. Done. — powered by Stellar blockchain.<br />
              No merchant fees, no waiting times, no headaches.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-10">
              <button
                onClick={handleVendorClick}
                className="group flex items-center justify-center gap-2.5 text-white font-bold px-8 py-4 rounded-2xl transition-all active:scale-95 shadow-lg hover:opacity-90 text-base"
                style={{ backgroundColor: '#0F766E' }}
              >
                <QrCode size={19} />
                I'm a Vendor
                <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={handleCustomerClick}
                className="group flex items-center justify-center gap-2.5 font-bold px-8 py-4 rounded-2xl transition-all active:scale-95 text-base border bg-white hover:bg-slate-50"
                style={{ borderColor: '#E2E8F0', color: '#334155' }}
              >
                <ScanLine size={19} />
                I'm a Customer
                <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            <div className="flex flex-wrap gap-5 mb-12">
              {['No bank account needed', '< ₱0.01 per transaction', '5-second settlement'].map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-sm font-medium text-slate-500">
                  <CheckCircle size={14} style={{ color: '#0F766E' }} className="shrink-0" />
                  {t}
                </span>
              ))}
            </div>

            <div className="pt-8 border-t border-slate-200 grid grid-cols-3 gap-6">
              {[
                { value: '12,400+', label: 'Active Vendors' },
                { value: '₱8.4M',   label: 'Weekly Volume' },
                { value: '3.2s',    label: 'Avg Settlement' },
              ].map(({ value, label }) => (
                <div key={label}>
                  <p className="text-2xl font-black" style={{ color: '#0F766E', fontFamily: "'Syne', sans-serif" }}>{value}</p>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right panel — dark teal ── */}
        <div
          className="relative flex items-center justify-center overflow-hidden"
          style={{ backgroundColor: '#0A3D38', borderBottomLeftRadius: 64, minHeight: '70vh' }}
        >
          {/* Ambient glow */}
          <div
            className="absolute pointer-events-none"
            style={{
              width: '520px', height: '520px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(20,184,166,0.22) 0%, transparent 70%)',
              filter: 'blur(70px)',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          />

          {/* ── Aling Nena store card — near phone ── */}
          <div
            className="absolute z-20 hidden lg:block animate-float"
            style={{
              top: '13%', left: '3%',
              width: 210,
              backgroundColor: 'rgba(10,30,28,0.82)',
              border: '1px solid rgba(255,255,255,0.13)',
              backdropFilter: 'blur(18px)',
              borderRadius: 18,
              padding: '14px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.05)',
            }}
          >
            {/* Header row */}
            <div className="flex items-center gap-2.5 mb-3">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                style={{ backgroundColor: 'rgba(20,184,166,0.18)', border: '1px solid rgba(20,184,166,0.3)' }}
              >🥦</div>
              <div className="min-w-0">
                <p className="font-black text-white text-sm leading-tight truncate" style={{ fontFamily: "'Syne', sans-serif" }}>
                  Aling Nena
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className="text-xs font-bold px-1.5 py-0.5 rounded-md"
                    style={{ backgroundColor: 'rgba(20,184,166,0.2)', color: '#2DD4BF', fontSize: 9 }}
                  >GULAYAN</span>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>Stall 14</span>
                </div>
              </div>
              {/* Live pill */}
              <div
                className="ml-auto shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.25)' }}
              >
                <span className="w-1 h-1 rounded-full animate-pulse" style={{ backgroundColor: '#4ADE80' }} />
                <span style={{ color: '#4ADE80', fontSize: 9, fontWeight: 700 }}>LIVE</span>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginBottom: 10 }} />

            {/* Stats */}
            <div className="grid grid-cols-2 gap-1.5 mb-3">
              <div
                className="rounded-xl px-2.5 py-2"
                style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
              >
                <p className="font-black text-white" style={{ fontSize: 15, fontFamily: "'Syne', sans-serif" }}>₱1,840</p>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Today</p>
              </div>
              <div
                className="rounded-xl px-2.5 py-2"
                style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
              >
                <p className="font-black text-white" style={{ fontSize: 15, fontFamily: "'Syne', sans-serif" }}>24</p>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Payments</p>
              </div>
            </div>

            {/* Footer: rating + market */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-0.5">
                {[1,2,3,4,5].map(i => (
                  <svg key={i} width="10" height="10" viewBox="0 0 10 10" fill={i <= 4 ? '#FBBF24' : 'rgba(255,255,255,0.15)'}>
                    <path d="M5 1l1.12 2.27L9 3.64l-2 1.95.47 2.76L5 7l-2.47 1.35L3 5.59 1 3.64l2.88-.37z"/>
                  </svg>
                ))}
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, marginLeft: 3 }}>4.8</span>
              </div>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9 }}>Cubao Market</span>
            </div>
          </div>

          {/* ── Phone — centered, rotation outer + float inner ── */}
          <div className="relative z-10" style={{ transform: 'rotate(15deg)' }}>
            <div className="animate-float" style={{ animationDelay: '0.3s' }}>
              <div
                className="relative shadow-2xl"
                style={{
                  width: '300px',
                  backgroundColor: '#1C2B3A',
                  borderRadius: '3.2rem',
                  padding: '3px',
                  boxShadow: '0 50px 100px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.06)',
                }}
              >
                <div className="absolute rounded-l-sm" style={{ width: 4, height: 32, backgroundColor: '#2D3F50', top: 90, left: -4 }} />
                <div className="absolute rounded-l-sm" style={{ width: 4, height: 50, backgroundColor: '#2D3F50', top: 138, left: -4 }} />
                <div className="absolute rounded-l-sm" style={{ width: 4, height: 50, backgroundColor: '#2D3F50', top: 200, left: -4 }} />
                <div className="absolute rounded-r-sm" style={{ width: 4, height: 64, backgroundColor: '#2D3F50', top: 130, right: -4 }} />
                <div
                  className="absolute inset-0 pointer-events-none z-10 rounded-[3.1rem]"
                  style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%)' }}
                />
                <div className="overflow-hidden" style={{ borderRadius: '2.9rem' }}>
                  <img src={phoneImg} alt="PalengkePay app" className="w-full block" />
                </div>
              </div>
            </div>
          </div>

          {/* ── Payment received card — right side, mid-height ── */}
          <div
            className="absolute z-20 animate-float-slow hidden lg:flex items-center gap-2.5"
            style={{
              top: '42%', right: '5%',
              backgroundColor: 'white',
              borderRadius: 14,
              padding: '10px 14px',
              boxShadow: '0 8px 28px rgba(0,0,0,0.22)',
              whiteSpace: 'nowrap',
            }}
          >
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#DCFCE7' }}>
              <CheckCircle size={13} style={{ color: '#16A34A' }} />
            </div>
            <div>
              <p className="text-xs font-black text-slate-800">₱245.00 received</p>
              <p style={{ fontSize: 10, color: '#6B7280' }}>Confirmed in 3.1s ⚡</p>
            </div>
          </div>

          {/* ── Recent payments feed — lower-left ── */}
          <div
            className="absolute z-20 hidden lg:block animate-float-slow"
            style={{ bottom: '9%', left: '6%', width: 200, animationDelay: '0.8s' }}
          >
            <div
              className="rounded-2xl px-3 py-2.5"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)' }}
            >
              <p className="font-bold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9 }}>Recent Payments</p>
              {[
                { name: 'Maria Santos',   amount: '₱145', init: 'M', color: '#14B8A6' },
                { name: 'Juan dela Cruz', amount: '₱320', init: 'J', color: '#A78BFA' },
                { name: 'Rosa Reyes',     amount: '₱85',  init: 'R', color: '#FB923C' },
              ].map(({ name, amount, init, color }) => (
                <div key={name} className="flex items-center justify-between py-1.5 border-b last:border-b-0" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center font-bold shrink-0"
                      style={{ backgroundColor: color + '33', color, fontSize: 9 }}
                    >{init}</div>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>{name}</span>
                  </div>
                  <span className="font-black text-white" style={{ fontSize: 11 }}>{amount}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Stellar badge — bottom center ── */}
          <div className="absolute bottom-5 left-0 right-0 flex items-center justify-center gap-1.5 pointer-events-none">
            <ShieldCheck size={12} style={{ color: '#4ADE80' }} />
            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>Secured by Stellar Blockchain</span>
          </div>
        </div>
      </section>

      {/* ══ HOW IT WORKS ════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-14">
          <div className="text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#0F766E' }}>
              Paano gumagana
            </span>
            <h2
              className="font-black text-slate-900 mt-2 tracking-tight"
              style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontFamily: "'Syne', sans-serif" }}
            >
              How it works
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
            {/* Connector line */}
            <div
              className="hidden lg:block absolute h-px pointer-events-none"
              style={{ top: 56, left: 'calc(33.33% + 24px)', right: 'calc(33.33% + 24px)', backgroundColor: '#E2E8F0' }}
            />

            {[
              { step: '01', icon: QrCode,   color: '#0F766E', bg: '#F0FDFA', title: 'Vendor gets a QR',   desc: 'Register your stall and receive a unique QR code linked to your Stellar wallet. Display it at your stall.' },
              { step: '02', icon: ScanLine, color: '#7C3AED', bg: '#F5F3FF', title: 'Customer scans',     desc: 'Open PalengkePay, aim at the QR code, enter the amount and what you bought. Done in 5 seconds.' },
              { step: '03', icon: Zap,      color: '#D97706', bg: '#FFFBEB', title: 'Instant settlement', desc: 'XLM transfers on Stellar blockchain — confirmed in ~3 seconds. Permanent, dispute-proof record.' },
            ].map(({ step, icon: Icon, color, bg, title, desc }) => (
              <div key={step} className="relative group">
                {/* Giant decorative number */}
                <div
                  className="absolute font-black select-none pointer-events-none"
                  style={{ fontSize: '9rem', color: '#F1F5F9', top: -32, left: -8, lineHeight: 1, zIndex: 0, fontFamily: "'Syne', sans-serif" }}
                >
                  {step}
                </div>

                <div className="relative z-10 bg-white rounded-3xl p-7 shadow-sm border border-slate-100 group-hover:shadow-lg group-hover:border-slate-200 transition-all">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5" style={{ backgroundColor: bg }}>
                    <Icon size={24} style={{ color }} />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 mb-2">{title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FEATURES ════════════════════════════════════════════════════════ */}
      <section id="features" className="py-24" style={{ backgroundColor: '#FAFAF7' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-14">
          <div className="text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#0F766E' }}>Mga Features</span>
            <h2
              className="font-black text-slate-900 mt-2 tracking-tight"
              style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontFamily: "'Syne', sans-serif" }}
            >
              Built for the palengke
            </h2>
          </div>

          {/* Asymmetric: large hero card + 3 cards */}
          <div className="grid lg:grid-cols-3 gap-4">
            {/* Big hero feature card — col 1, rows 1-2 */}
            <div
              className="rounded-3xl p-8 lg:p-10 flex flex-col justify-between lg:row-span-2"
              style={{ backgroundColor: '#0F766E', minHeight: 300 }}
            >
              <div>
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-7"
                  style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
                >
                  <QrCode size={28} color="white" />
                </div>
                <h3
                  className="font-black text-white mb-4"
                  style={{ fontSize: '1.6rem', fontFamily: "'Syne', sans-serif" }}
                >
                  QR Payments
                </h3>
                <p className="leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.975rem' }}>
                  Display your unique QR code at your stall. Customers scan, enter the amount,
                  and confirm — money lands in your Stellar wallet in seconds. No card terminal.
                  No fees. No bank account required.
                </p>
              </div>
              <div className="mt-8 pt-6 border-t" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
                <span className="font-black text-white" style={{ fontSize: '2.5rem', fontFamily: "'Syne', sans-serif" }}>₱0</span>
                <span className="text-sm ml-2" style={{ color: 'rgba(255,255,255,0.55)' }}>merchant fees. Ever.</span>
              </div>
            </div>

            {/* Row 1, cols 2-3: Utang + Immutable */}
            {[
              { icon: HandCoins,   color: '#7C3AED', title: 'Utang Credit',      desc: 'Formalize installment plans on-chain. Track payments, due dates, and balances with full transparency.' },
              { icon: ShieldCheck, color: '#059669', title: 'Immutable Records', desc: 'Every transaction permanently on Stellar blockchain. Dispute-proof. Your ledger never lies.' },
            ].map(({ icon: Icon, color, title, desc }) => (
              <div
                key={title}
                className="rounded-3xl p-6 border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all bg-white"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: `${color}18` }}>
                  <Icon size={22} style={{ color }} />
                </div>
                <h3 className="font-black text-slate-900 mb-1.5">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}

            {/* Row 2, cols 2-3: Mobile PWA spans 2 cols */}
            <div className="lg:col-span-2 rounded-3xl p-6 border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all bg-white flex items-center gap-6">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#D9770618' }}>
                <Smartphone size={26} style={{ color: '#D97706' }} />
              </div>
              <div>
                <h3 className="font-black text-slate-900 mb-1">Mobile-first PWA</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Install from your browser on any Android or iPhone. Works offline. No app store, no updates — just open and go. Feels like a native app.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ BOTTOM CTA ══════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden py-28" style={{ backgroundColor: '#0A3D38' }}>
        {/* Decorative blobs */}
        <div
          className="absolute pointer-events-none"
          style={{ width: 400, height: 400, top: -100, right: -80, borderRadius: '50%', backgroundColor: 'rgba(20,184,166,0.1)' }}
        />
        <div
          className="absolute pointer-events-none"
          style={{ width: 300, height: 300, bottom: -80, left: -40, borderRadius: '50%', backgroundColor: 'rgba(245,158,11,0.07)' }}
        />

        {/* Giant ₱ watermark */}
        <div
          className="absolute font-black select-none pointer-events-none"
          style={{
            fontSize: '28rem', color: 'rgba(255,255,255,0.025)', lineHeight: 1,
            top: '50%', left: '50%', transform: 'translate(-50%, -52%)',
            fontFamily: "'Syne', sans-serif",
          }}
        >
          ₱
        </div>

        <div className="relative max-w-7xl mx-auto px-6 lg:px-14 text-center">
          <div
            className="inline-flex items-center gap-2 border text-xs font-bold px-3 py-1.5 rounded-full mb-8"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#4ADE80' }} />
            Testnet — try it free today
          </div>

          <h2
            className="font-black text-white tracking-tight mb-5"
            style={{ fontSize: 'clamp(2.5rem, 5vw, 4.5rem)', fontFamily: "'Syne', sans-serif" }}
          >
            Ready to go digital?
          </h2>
          <p
            className="mb-10 max-w-md mx-auto leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.55)', fontSize: '1.1rem' }}
          >
            Join vendors already accepting digital payments. No setup fees.
            No monthly costs. Just scan and pay.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleVendorClick}
              className="flex items-center justify-center gap-2.5 font-bold px-10 py-4 rounded-2xl transition-all active:scale-95 text-base shadow-xl hover:opacity-90"
              style={{ backgroundColor: '#F59E0B', color: '#1C1917' }}
            >
              <QrCode size={20} />
              Register as Vendor
            </button>
            <button
              onClick={() => navigate('/onboard')}
              className="flex items-center justify-center gap-2.5 font-bold px-10 py-4 rounded-2xl transition-all active:scale-95 text-base border hover:bg-white/5"
              style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'white' }}
            >
              Start Setup Guide
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ══════════════════════════════════════════════════════════ */}
      <footer className="py-8 border-t" style={{ backgroundColor: '#081F1D', borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-14 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
              <span className="text-white text-xs font-black">₱</span>
            </div>
            <span className="font-bold" style={{ color: 'rgba(255,255,255,0.55)', fontFamily: "'Syne', sans-serif" }}>PalengkePay</span>
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.3)' }}
            >
              Testnet
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>
            <span className="flex items-center gap-1.5"><ShieldCheck size={12} style={{ color: '#4ADE80' }} />Stellar Blockchain</span>
            <span className="flex items-center gap-1.5"><Zap size={12} style={{ color: '#FDE68A' }} />~3s Settlement</span>
            <span className="flex items-center gap-1.5"><Star size={12} style={{ color: '#93C5FD' }} />Made in Philippines 🇵🇭</span>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 lg:px-14 mt-4 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Created by <span style={{ color: 'rgba(255,255,255,0.45)' }}>Paul Dacalan</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
