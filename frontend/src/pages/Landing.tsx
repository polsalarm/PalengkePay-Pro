import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ScanLine, QrCode, Zap, ShieldCheck, ArrowRight,
  Smartphone, CheckCircle, HandCoins, Star,
} from 'lucide-react';
import { useWallet } from '../lib/hooks/useWallet';
import { isRegisteredVendor } from '../lib/hooks/useVendor';
import phoneImg from '../assets/phone.png';
import logoImg from '../assets/logo.png';
import ctaBgImg from '../assets/cta-bg.png';

// ── Main component ──────────────────────────────────────────────────────────
export function Landing() {
  const navigate = useNavigate();
  const { address, isConnected, connect } = useWallet();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
   <div className="min-h-screen" style={{ backgroundColor: '#FAFAF7' }}>

      {/* ══ NAVBAR ══════════════════════════════════════════════════════════ */}
     {/* ══ NAVBAR - Sticky White Header ═══════════════════════════════════════════ */}
{/* ══ NAVBAR - Sticky White Header with Mobile Menu ═══════════════════════ */}
<header
  className="sticky top-0 z-50 w-full"
  style={{
    position: 'sticky',
    top: 0,
    backgroundColor: '#FFFFFF',
    borderBottom: '1px solid #E2E8F0',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)'
  }}
>
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="flex items-center justify-between h-16">

      {/* Logo Section */}
      <div className="flex items-center gap-2.5 shrink-0">
        <img
          src={logoImg}
          alt="PalengkePay"
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-cover"
        />
        <span
          className="font-black text-base sm:text-lg tracking-tight whitespace-nowrap"
          style={{ fontFamily: "'Montserrat', sans-serif" }}
        >
          <span style={{ color: '#00284B' }}>Palengke</span>
          <span style={{ color: '#008055' }}>Pay</span>
        </span>
      </div>

      {/* Desktop Navigation Links */}
      <nav className="hidden md:flex items-center gap-6 lg:gap-8">
        <button
          onClick={handleVendorClick}
          className="text-sm font-medium transition-colors duration-200 hover:text-[#008055]"
          style={{ color: '#475569' }}
        >
          For Vendors
        </button>
        <button
          onClick={handleCustomerClick}
          className="text-sm font-medium transition-colors duration-200 hover:text-[#008055]"
          style={{ color: '#475569' }}
        >
          For Customers
        </button>
        <a
          href="#how-it-works"
          className="text-sm font-medium transition-colors duration-200 hover:text-[#008055]"
          style={{ color: '#475569' }}
        >
          How it works
        </a>
        <a
          href="#features"
          className="text-sm font-medium transition-colors duration-200 hover:text-[#008055]"
          style={{ color: '#475569' }}
        >
          Features
        </a>
      </nav>

      {/* Desktop CTA Button */}
      <div className="hidden md:flex items-center gap-3 shrink-0">
        <button
          onClick={() => navigate('/connect')}
          className="flex items-center gap-2 text-white text-sm font-bold px-4 py-2 rounded-xl transition-all duration-200 active:scale-95 hover:opacity-90 shadow-sm whitespace-nowrap"
          style={{ backgroundColor: '#008055' }}
        >
          Get Started — It's Free
        </button>
      </div>

      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="md:hidden p-2 rounded-lg transition-colors duration-200 hover:bg-slate-100"
        style={{ color: '#475569' }}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isMobileMenuOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>
    </div>
  </div>

  {/* Mobile Menu Dropdown */}
  {isMobileMenuOpen && (
    <div
      className="md:hidden absolute top-16 left-0 right-0 z-40 shadow-lg"
      style={{ backgroundColor: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}
    >
      <div className="px-4 py-3 flex flex-col gap-2">
        <button
          onClick={() => {
            handleVendorClick();
            setIsMobileMenuOpen(false);
          }}
          className="text-left text-sm font-medium py-3 px-3 rounded-lg transition-colors hover:bg-slate-50 active:bg-slate-100"
          style={{ color: '#475569' }}
        >
          For Vendors
        </button>
        <button
          onClick={() => {
            handleCustomerClick();
            setIsMobileMenuOpen(false);
          }}
          className="text-left text-sm font-medium py-3 px-3 rounded-lg transition-colors hover:bg-slate-50 active:bg-slate-100"
          style={{ color: '#475569' }}
        >
          For Customers
        </button>
        <a
          href="#how-it-works"
          onClick={() => setIsMobileMenuOpen(false)}
          className="text-sm font-medium py-3 px-3 rounded-lg transition-colors hover:bg-slate-50 active:bg-slate-100"
          style={{ color: '#475569' }}
        >
          How it works
        </a>
        <a
          href="#features"
          onClick={() => setIsMobileMenuOpen(false)}
          className="text-sm font-medium py-3 px-3 rounded-lg transition-colors hover:bg-slate-50 active:bg-slate-100"
          style={{ color: '#475569' }}
        >
          Features
        </a>
        <div className="pt-2 mt-1 border-t" style={{ borderColor: '#E2E8F0' }}>
          <button
            onClick={() => {
              navigate('/connect');
              setIsMobileMenuOpen(false);
            }}
            className="w-full flex items-center justify-center gap-2 text-white text-sm font-bold px-4 py-3 rounded-xl transition-all active:scale-95"
            style={{ backgroundColor: '#008055' }}
          >
            Get Started — It's Free
          </button>
        </div>
      </div>
    </div>
  )}
</header>

      {/* ══ HERO ════════════════════════════════════════════════════════════ */}
      <section
  className="lg:grid lg:grid-cols-[75fr_75fr]"  // 75% left, 25% right
  style={{ minHeight: 'calc(100vh - 64px)' }}
>
        {/* ── Left panel — cream ── */}
        <div
          className="relative flex items-center py-16 lg:py-0 overflow-hidden"
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
          {/* Content — centered with balanced margins */}
          <div className="relative z-10 w-full max-w-[580px] mx-auto px-6 lg:px-8 xl:px-12">
            {/* Live badge */}
            <div
  className="inline-flex items-center gap-2 border text-xs font-bold px-3.5 py-1.5 rounded-full mb-8"
  style={{
    backgroundColor: '#E6F7F5',  // Light version of #008055 (10% opacity)
    borderColor: '#008055',
    color: '#008055'
  }}
>
  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#008055' }} />
  Live on Stellar Testnet
</div>

            <h1
              className="font-black text-slate-900 leading-[1.05] tracking-tight mb-6"
              style={{ fontSize: 'clamp(2.8rem, 3.4vw, 4.4rem)', fontFamily: "'Montserrat', sans-serif" }}
            >
              Digital<br />payments<br />
              <span style={{ color: '#008055' }}>para sa</span>{' '}
              <span className="relative inline-block">
                <span className="relative" style={{ zIndex: 1 }}>palengke</span>
                <span
                  className="absolute left-0 right-0 bottom-[0.06em] rounded"
                  style={{ height: '0.32em', backgroundColor: '#FDE68A', zIndex: 0 }}
                />
              </span>
            </h1>

            <p className="text-slate-500 leading-relaxed mb-10 max-w-[480px]" style={{ fontSize: '1.125rem' }}>
              Scan. Pay. Done. — powered by Stellar blockchain.<br />
              No merchant fees, no waiting times, no headaches.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-12">
              <button
                onClick={handleVendorClick}
                className="group flex items-center justify-center gap-2.5 text-white font-bold px-8 py-4 rounded-2xl transition-all active:scale-95 shadow-lg hover:opacity-90 text-base"
                style={{ backgroundColor: '#008055' }}
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

            {/* Simple benefit badges - clean and minimal */}
            <div className="flex flex-wrap gap-3">
              {[
                { text: 'No bank account needed', icon: '🏦' },
                { text: '< ₱0.01 per transaction', icon: '⚡' },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm">
                  <span className="text-sm">{item.icon}</span>
                  <span className="text-xs font-medium text-slate-600">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right panel — dark teal (improved floating elements) ── */}
        <div
          className="relative flex items-center justify-center overflow-hidden"
          style={{ backgroundColor: '#00284B', borderBottomLeftRadius: 64, minHeight: '70vh' }}
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

          {/* ── Aling Nena store card — enhanced ── */}
          <div
            className="absolute z-20 hidden lg:block animate-float"
            style={{
              top: '8%', left: '2%',
              width: 240,
              backgroundColor: 'rgba(10,30,28,0.88)',
              border: '1px solid rgba(255,255,255,0.15)',
              backdropFilter: 'blur(20px)',
              borderRadius: 20,
              padding: '16px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)',
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                style={{ backgroundColor: 'rgba(20,184,166,0.2)', border: '1px solid rgba(20,184,166,0.4)' }}
              >🥦</div>
              <div className="min-w-0 flex-1">
                <p className="font-black text-white text-base leading-tight truncate" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                  Aling Nena's
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-md"
                    style={{ backgroundColor: 'rgba(20,184,166,0.25)', color: '#2DD4BF', fontSize: 9 }}
                  >FRESH VEGGIES</span>
                </div>
              </div>
              <div
                className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-full"
                style={{ backgroundColor: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#4ADE80' }} />
                <span style={{ color: '#4ADE80', fontSize: 9, fontWeight: 700 }}>OPEN</span>
              </div>
            </div>

            <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 12 }} />

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="rounded-xl px-3 py-2" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                <p className="font-black text-white text-base">₱1,840</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Today's Sales</p>
              </div>
              <div className="rounded-xl px-3 py-2" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                <p className="font-black text-white text-base">24</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Transactions</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <Star key={i} size={10} fill={i <= 4 ? '#FBBF24' : 'rgba(255,255,255,0.2)'} stroke="none" />
                ))}
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, marginLeft: 4 }}>4.8 (189 reviews)</span>
              </div>
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, fontWeight: 500 }}>Stall 14 • Cubao</span>
            </div>
          </div>

          {/* ── Phone — centered ── */}
          {/* ── Phone — centered with better padding ── */}
<div className="relative z-10" style={{ transform: 'rotate(12deg)' }}>
  <div className="animate-float" style={{ animationDelay: '0.2s' }}>
    <div
      className="relative shadow-2xl"
      style={{
        width: '320px',
        backgroundColor: '#1C2B3A',
        borderRadius: '3.2rem',
        padding: '8px',
        boxShadow: '0 50px 100px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.08)',
      }}
    >
      {/* Phone bezel details - adjusted positions */}
      <div className="absolute rounded-l-sm" style={{ width: 4, height: 32, backgroundColor: '#2D3F50', top: 90, left: -4 }} />
      <div className="absolute rounded-l-sm" style={{ width: 4, height: 50, backgroundColor: '#2D3F50', top: 138, left: -4 }} />
      <div className="absolute rounded-l-sm" style={{ width: 4, height: 50, backgroundColor: '#2D3F50', top: 200, left: -4 }} />
      <div className="absolute rounded-r-sm" style={{ width: 4, height: 64, backgroundColor: '#2D3F50', top: 130, right: -4 }} />

      {/* Top notch / dynamic island */}
      <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-24 h-5 bg-black/60 rounded-full z-20" />

      {/* Screen gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-10 rounded-[2.8rem]"
        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.1) 100%)' }}
      />

      {/* Screen content with padding */}
      <div className="overflow-hidden rounded-[2.6rem] bg-white">
        <img
          src={phoneImg}
          alt="PalengkePay app"
          className="w-full h-auto block"
          style={{ objectFit: 'cover' }}
        />
      </div>

      {/* Bottom home indicator */}
      <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-32 h-1 bg-white/30 rounded-full" />
    </div>
  </div>
</div>

          {/* ── Payment received card — enhanced ── */}
          <div
            className="absolute z-20 animate-float-slow hidden lg:flex items-center gap-3"
            style={{
              top: '35%', right: '3%',
              backgroundColor: 'rgba(255,255,255,0.98)',
              borderRadius: 18,
              padding: '12px 18px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.1)',
              backdropFilter: 'blur(4px)',
            }}
          >
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#DCFCE7' }}>
              <CheckCircle size={16} style={{ color: '#16A34A' }} />
            </div>
            <div>
              <p className="text-sm font-black text-slate-800">₱245.00 received</p>
              <div className="flex items-center gap-2 mt-0.5">
                <p style={{ fontSize: 10, color: '#6B7280' }}>Confirmed in 3.1s</p>
                <span className="text-xs">⚡</span>
              </div>
            </div>
          </div>

          {/* ── Recent payments feed — improved styling ── */}
          <div
            className="absolute z-20 hidden lg:block animate-float-slow"
            style={{ bottom: '12%', left: '2%', width: 220, animationDelay: '0.6s' }}
          >
            <div
              className="rounded-2xl p-3"
              style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)' }}
            >
              <p className="font-bold uppercase tracking-wider mb-2.5 flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9 }}>
                <Zap size={10} /> Live Activity
              </p>
              {[
                { name: 'Maria Santos', amount: '₱145', time: 'just now', color: '#14B8A6' },
                { name: 'Juan dela Cruz', amount: '₱320', time: '2 min ago', color: '#A78BFA' },
                { name: 'Rosa Reyes', amount: '₱85', time: '5 min ago', color: '#FB923C' },
              ].map(({ name, amount, time, color }) => (
                <div key={name} className="flex items-center justify-between py-2 border-b last:border-b-0" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center font-bold shrink-0 text-xs"
                      style={{ backgroundColor: color + '22', color }}
                    >
                      {name.charAt(0)}
                    </div>
                    <div>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{name}</span>
                      <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>{time}</p>
                    </div>
                  </div>
                  <span className="font-black text-white text-sm">{amount}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Stellar badge ── */}
          <div className="absolute bottom-5 left-0 right-0 flex items-center justify-center gap-2 pointer-events-none">
            <ShieldCheck size={12} style={{ color: '#4ADE80' }} />
            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>Secured by Stellar Blockchain</span>
            <span className="w-1 h-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.3)' }} />
            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>Instant Settlement</span>
          </div>
        </div>
      </section>

      {/* ══ HOW IT WORKS ════════════════════════════════════════════════════ */}
      {/* ══ HOW IT WORKS - Premium Design ═══════════════════════════════════ */}
<section id="how-it-works" className="py-24 relative overflow-hidden" style={{ backgroundColor: '#FFFFFF' }}>
  {/* Background decoration */}
  <div className="absolute inset-0 pointer-events-none">
    <div className="absolute top-0 right-0 w-96 h-96 rounded-full" style={{ backgroundColor: '#E8F5F3', filter: 'blur(100px)', opacity: 0.5 }} />
    <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full" style={{ backgroundColor: '#E8F5F3', filter: 'blur(100px)', opacity: 0.3 }} />
  </div>

  <div className="relative max-w-7xl mx-auto px-6 lg:px-14">
    {/* Section Header - Centered with gradient text */}
    <div className="text-center mb-16">
     <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4"
     style={{
       backgroundColor: '#E6F7F5',
       borderColor: '#008055',
       border: '1px solid #008055',
       color: '#008055'
     }}>
  <Zap size={14} style={{ color: '#008055' }} />
  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#008055' }}>
    Simple & Fast
  </span>
</div>
      <h2
        className="font-black text-slate-900 mt-2 tracking-tight"
        style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontFamily: "'Montserrat', sans-serif" }}
      >
        How it <span style={{ color: '#008055' }}>works</span>
      </h2>
      <p className="text-slate-500 mt-3 max-w-2xl mx-auto">
        Three simple steps to start accepting digital payments
      </p>
    </div>

    {/* Steps - Modern card design with connecting lines */}
    <div className="relative">
      {/* Desktop connecting line */}
      <div className="hidden lg:block absolute left-0 right-0 top-32 h-0.5" style={{ background: 'linear-gradient(90deg, #008055 0%, #008055 30%, #E2E8F0 30%, #E2E8F0 70%, #008055 70%, #008055 100%)' }} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative">
        {[
          {
            step: '01',
            icon: QrCode,
            color: '#008055',
            bg: '#E8F5F3',
            title: 'Get Your QR',
            desc: 'Register your stall and receive a unique QR code linked to your Stellar wallet. Display it prominently at your stall.',
            highlight: 'Free to register'
          },
          {
            step: '02',
            icon: ScanLine,
            color: '#042E80',
            bg: '#F5F3FF',
            title: 'Customer Scans',
            desc: 'Customer opens PalengkePay, scans your QR code, enters the amount, and confirms. Takes less than 5 seconds.',
            highlight: 'No card needed'
          },
          {
            step: '03',
            icon: Zap,
            color: '#D97706',
            bg: '#FFFBEB',
            title: 'Instant Payment',
            desc: 'Payment settles instantly on Stellar blockchain. Money appears in your wallet in ~3 seconds. No waiting, no chargebacks.',
            highlight: '~3s settlement'
          },
        ].map(({ step, icon: Icon, color, bg, title, desc, highlight }, index) => (
          <div key={step} className="relative group">
            {/* Step number badge */}
            <div className="absolute -top-4 left-6 lg:left-8 z-10">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center font-black shadow-lg"
                style={{
                  backgroundColor: color,
                  color: 'white',
                  fontSize: '1.1rem',
                  fontFamily: "'Montserrat', sans-serif"
                }}
              >
                {index + 1}
              </div>
            </div>

            {/* Card */}
            <div
              className="relative bg-white rounded-3xl p-8 pt-12 shadow-sm border-2 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
              style={{ borderColor: index === 0 ? '#00805520' : '#E2E8F0' }}
            >
              {/* Icon */}
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-all group-hover:scale-110"
                style={{ backgroundColor: bg }}
              >
                <Icon size={28} style={{ color }} />
              </div>

              {/* Title */}
              <h3 className="text-xl font-black text-slate-900 mb-3" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                {title}
              </h3>

              {/* Description */}
              <p className="text-sm text-slate-500 leading-relaxed mb-4">
                {desc}
              </p>

              {/* Highlight badge */}
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{ backgroundColor: `${color}10`, color: color }}
              >
                {index === 0 && '✨'}
                {index === 1 && '📱'}
                {index === 2 && '⚡'}
                {highlight}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Bottom CTA within how it works */}
    <div className="mt-16 text-center">
      <div className="inline-flex items-center gap-2 text-sm text-slate-500">
        <span>Ready to get started?</span>
        <button
          onClick={handleVendorClick}
          className="inline-flex items-center gap-1 font-semibold transition-all hover:gap-2"
          style={{ color: '#008055' }}
        >
          Join now <ArrowRight size={14} />
        </button>
      </div>
    </div>
  </div>
</section>

      {/* ══ FEATURES ════════════════════════════════════════════════════════ */}
      {/* ══ FEATURES - Enhanced Premium Design ═══════════════════════════════════ */}
<section id="features" className="py-24 relative overflow-hidden" style={{ backgroundColor: '#FAFAF7' }}>
  {/* Background decoration */}
  <div className="absolute inset-0 pointer-events-none">
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full"
         style={{ backgroundColor: '#E8F5F3', filter: 'blur(120px)', opacity: 0.4 }} />
  </div>

  <div className="relative max-w-7xl mx-auto px-6 lg:px-14">
    {/* Section Header */}
    <div className="text-center mb-16">
     <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4"
     style={{
       backgroundColor: '#E6F7F5',
       borderColor: '#008055',
       border: '1px solid #008055',
       color: '#008055'
     }}>
  <Star size={14} style={{ color: '#008055' }} />
  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#008055' }}>
    Why Choose Us
  </span>
</div>
      <h2
        className="font-black text-slate-900 mt-2 tracking-tight"
        style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontFamily: "'Montserrat', sans-serif" }}
      >
        Built for the <span style={{ color: '#008055' }}>palengke</span>
      </h2>
      <p className="text-slate-500 mt-3 max-w-2xl mx-auto">
        Everything you need to accept digital payments seamlessly
      </p>
    </div>

    {/* Feature Grid - Main Layout */}
    <div className="grid lg:grid-cols-12 gap-6">

      {/* Main Hero Feature - Spans 5 columns */}
      <div className="lg:col-span-5">
        <div
          className="relative h-full rounded-3xl p-8 lg:p-10 overflow-hidden group cursor-pointer transition-all duration-500 hover:shadow-2xl"
          style={{ backgroundColor: '#008055' }}
        >
          {/* Animated background pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-white blur-3xl" />
            <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-white blur-3xl" />
          </div>

          {/* Content */}
          <div className="relative z-10 flex flex-col h-full">
            <div className="mb-6">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 bg-white/20 backdrop-blur-sm">
                <QrCode size={32} color="white" />
              </div>
              <h3 className="font-black text-white text-2xl mb-3" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                QR Payments
              </h3>
              <div className="w-12 h-1 bg-white/40 rounded-full mb-4" />
              <p className="text-white/80 leading-relaxed mb-6">
                Display your unique QR code at your stall. Customers scan, enter the amount, and confirm — money lands in your Stellar wallet in seconds.
              </p>
            </div>

            {/* Feature highlights */}
            <div className="space-y-3 mt-auto">
              <div className="flex items-center gap-3 text-white/80">
                <CheckCircle size={16} className="text-white" />
                <span className="text-sm">No card terminal needed</span>
              </div>
              <div className="flex items-center gap-3 text-white/80">
                <CheckCircle size={16} className="text-white" />
                <span className="text-sm">No bank account required</span>
              </div>
              <div className="flex items-center gap-3 text-white/80">
                <CheckCircle size={16} className="text-white" />
                <span className="text-sm">Works on any smartphone</span>
              </div>
            </div>

            {/* Zero fees badge */}
            <div className="mt-8 pt-6 border-t border-white/20">
              <div className="flex items-baseline gap-2">
                <span className="font-black text-white text-4xl" style={{ fontFamily: "'Montserrat', sans-serif" }}>₱0</span>
                <span className="text-white/60 text-sm font-medium">merchant fees. Ever.</span>
              </div>
              <p className="text-white/50 text-xs mt-1">No hidden charges, no monthly fees</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column - 7 columns with sub-grid */}
      <div className="lg:col-span-7">
        <div className="grid md:grid-cols-2 gap-6 h-full">

          {/* Utang Credit Card */}
          <div className="group bg-white rounded-3xl p-6 border border-slate-200 hover:border-[#008055]/30 hover:shadow-xl transition-all duration-300 cursor-pointer">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-all group-hover:scale-110"
                 style={{ backgroundColor: '#042E8010' }}>
              <HandCoins size={26} style={{ color: '#042E80' }} />
            </div>
            <h3 className="font-black text-slate-900 text-xl mb-2">Utang Credit</h3>
            <p className="text-slate-500 text-sm leading-relaxed mb-4">
              Formalize installment plans on-chain. Track payments, due dates, and balances with full transparency.
            </p>

          </div>

          {/* Immutable Records Card */}
          <div className="group bg-white rounded-3xl p-6 border border-slate-200 hover:border-[#059669]/30 hover:shadow-xl transition-all duration-300 cursor-pointer">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-all group-hover:scale-110"
                 style={{ backgroundColor: '#05966910' }}>
              <ShieldCheck size={26} style={{ color: '#059669' }} />
            </div>
            <h3 className="font-black text-slate-900 text-xl mb-2">Immutable Records</h3>
            <p className="text-slate-500 text-sm leading-relaxed mb-4">
              Every transaction permanently on Stellar blockchain. Dispute-proof. Your ledger never lies.
            </p>

          </div>

          {/* Mobile-first PWA - Full width */}
          <div className="md:col-span-2 group bg-gradient-to-r from-white to-slate-50 rounded-3xl p-6 border border-slate-200 hover:border-[#D97706]/30 hover:shadow-xl transition-all duration-300 cursor-pointer">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 shrink-0"
                   style={{ backgroundColor: '#D9770610' }}>
                <Smartphone size={30} style={{ color: '#D97706' }} />
              </div>
              <div className="flex-1">
                <h3 className="font-black text-slate-900 text-xl mb-2">Mobile-first PWA</h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  Install from your browser on any Android or iPhone. Works offline. No app store, no updates — just open and go. Feels like a native app.
                </p>
              </div>
              <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#D97706]/10">
                <span className="text-xs font-medium" style={{ color: '#D97706' }}>Available Now</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>


  </div>
</section>

    {/* ══ BOTTOM CTA - Pure Background Image, No Overlay ═══════════════════════ */}
<section
  className="relative w-full"
  style={{
    backgroundImage: `url(${ctaBgImg})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  }}
>
  {/* NO OVERLAY DIV - REMOVED COMPLETELY */}

  <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-14 py-16 sm:py-20 lg:py-28">
    <div className="max-w-2xl text-left">

      {/* Badge - with darker background for readability */}
      <div
        className="inline-flex items-center gap-2 border text-xs font-bold px-3 py-1.5 rounded-full mb-6"
        style={{ backgroundColor: '#00284B', borderColor: 'rgba(255,255,255,0.3)', color: 'white' }}
      >
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#4ADE80' }} />
        Testnet — try it free today
      </div>

      {/* Heading - white text with optional text shadow for readability */}
      <h2
        className="font-black text-white tracking-tight mb-4"
        style={{
          fontSize: 'clamp(2rem, 4vw, 3.5rem)',
          fontFamily: "'Montserrat', sans-serif",
          textShadow: '0 2px 4px rgba(0,0,0,0.3)'
        }}
      >
        Ready to go digital?
      </h2>

      {/* Description */}
      <p
        className="mb-8 max-w-lg leading-relaxed text-white"
        style={{
          fontSize: '1.1rem',
          textShadow: '0 1px 2px rgba(0,0,0,0.3)'
        }}
      >
        Join vendors already accepting digital payments. No setup fees.
        No monthly costs. Just scan and pay.
      </p>

      {/* Buttons */}
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={handleVendorClick}
          className="flex items-center justify-center gap-2.5 font-bold px-8 py-3.5 rounded-2xl transition-all active:scale-95 text-base shadow-lg hover:opacity-90"
          style={{ backgroundColor: '#008055', color: 'white' }}
        >
          <QrCode size={20} />
          Register as Vendor
        </button>
        <button
          onClick={() => navigate('/onboard')}
          className="flex items-center justify-center gap-2.5 font-bold px-8 py-3.5 rounded-2xl transition-all active:scale-95 text-base border hover:bg-white/10"
          style={{ borderColor: 'rgba(255,255,255,0.4)', color: 'white' }}
        >
          Start Setup Guide
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  </div>
</section>

      {/* ══ FOOTER ══════════════════════════════════════════════════════════ */}
      {/* ══ FOOTER ══════════════════════════════════════════════════════════ */}
{/* ══ FOOTER - Ultra Simple ═══════════════════════════════════════════ */}
<footer className="py-10 border-t" style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}>
  <div className="max-w-7xl mx-auto px-6 lg:px-14">
    <div className="flex flex-col md:flex-row items-center justify-between gap-6">

      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <img
          src={logoImg}
          alt="PalengkePay"
          className="w-8 h-8 rounded-lg object-cover"
        />
        <span className="font-black text-base tracking-tight" style={{ fontFamily: "'Montserrat', sans-serif" }}>
          <span style={{ color: '#00284B' }}>Palengke</span><span style={{ color: '#008055' }}>Pay</span>
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>
          Testnet
        </span>
      </div>

      {/* Quick Links */}
      <div className="flex flex-wrap items-center justify-center gap-6">
        <button onClick={handleVendorClick} className="text-sm text-slate-600 hover:text-[#008055] transition-colors">
          For Vendors
        </button>
        <button onClick={handleCustomerClick} className="text-sm text-slate-600 hover:text-[#008055] transition-colors">
          For Customers
        </button>
        <a href="#how-it-works" className="text-sm text-slate-600 hover:text-[#008055] transition-colors">
          How it Works
        </a>
        <a href="#features" className="text-sm text-slate-600 hover:text-[#008055] transition-colors">
          Features
        </a>
      </div>
    </div>

    {/* Bottom bar */}
    <div className="pt-6 mt-6 text-center border-t" style={{ borderColor: '#E2E8F0' }}>
      <p className="text-xs text-slate-400">
        © 2026 sTHREEllar. All rights reserved.
      </p>

    </div>
  </div>
</footer>
    </div>
  );
}
