import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Home, QrCode, ScanLine, List, User, UserPlus, Users, HandCoins, Store, ChevronLeft, ChevronRight, ArrowUp } from 'lucide-react';
import { WalletButton } from './WalletButton';
import logoImg from '../assets/logo.png';

const vendorNav = [
  { to: '/vendor/home', icon: Home, label: 'Home' },
  { to: '/vendor/qr', icon: QrCode, label: 'My QR' },
  { to: '/vendor/transactions', icon: List, label: 'History' },
  { to: '/vendor/utang', icon: HandCoins, label: 'Utang' },
  { to: '/vendor/profile', icon: User, label: 'Profile' },
];

const customerNav = [
  { to: '/customer/home', icon: Home, label: 'Home', center: false },
  { to: '/customer/history', icon: List, label: 'History', center: false },
  { to: '/customer/scan', icon: ScanLine, label: 'Scan', center: true },
  { to: '/customer/utang', icon: HandCoins, label: 'Utang', center: false },
  { to: '/market', icon: Store, label: 'Market', center: false },
];

const adminNav = [
  { to: '/admin/market', icon: Users, label: 'Dashboard' },
  { to: '/admin/register', icon: UserPlus, label: 'Register' },
];

const PAGE_TITLES: Record<string, string> = {
  '/vendor/home': 'Home',
  '/vendor/qr': 'My QR Code',
  '/vendor/transactions': 'Transactions',
  '/vendor/utang': 'Utang',
  '/vendor/profile': 'Profile',
  '/customer/home': 'Home',
  '/customer/history': 'Payment History',
  '/customer/scan': 'Scan & Pay',
  '/customer/utang': 'My Utang',
  '/market': 'Market Directory',
  '/admin/market': 'Market Dashboard',
  '/admin/register': 'Register Vendor',
  '/dashboard': 'Dashboard',
  '/vendor/apply': 'Apply as Vendor',
};

function useNavItems() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/vendor')) return vendorNav;
  if (pathname.startsWith('/customer') || pathname === '/market') return customerNav;
  if (pathname.startsWith('/admin')) return adminNav;
  return null;
}

function ScrollToTop({ scrollRef }: { scrollRef: React.RefObject<HTMLElement | null> }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setVisible(el.scrollTop > 300);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [scrollRef]);

  if (!visible) return null;

  return (
    <button
      onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-24 right-4 lg:bottom-8 lg:right-8 z-40 w-10 h-10 rounded-full bg-teal-700 hover:bg-teal-600 active:scale-95 text-white shadow-lg flex items-center justify-center transition-all"
      aria-label="Scroll to top"
    >
      <ArrowUp size={16} />
    </button>
  );
}

export function Layout() {
  const navItems = useNavItems();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const scrollRef = useRef<HTMLElement>(null);
  const isFullscreen = pathname === '/vendor/qr' || pathname === '/onboard' || pathname === '/customer/scan';
  const pageTitle = PAGE_TITLES[pathname] ?? '';

  if (isFullscreen) {
    return <Outlet />;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">

      {/* ── Desktop sidebar ─────────────────────────────── */}
      <aside
        className={`hidden lg:flex flex-col bg-white border-r border-slate-200 shrink-0 transition-all duration-300 relative ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        {/* Logo Section */}
        <div className={`flex items-center h-16 border-b border-slate-200 shrink-0 ${collapsed ? 'justify-center px-0' : 'gap-2.5 px-6'}`}>
          <img 
            src={logoImg} 
            alt="PalengkePay" 
            className="w-7 h-7 rounded-lg object-cover shrink-0"
          />
          {!collapsed && (
            <span className="font-semibold" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              <span style={{ color: '#00284B' }}>Palengke</span>
              <span style={{ color: '#008055' }}>Pay</span>
            </span>
          )}
        </div>

        {/* Navigation Links */}
        {navItems && (
          <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                title={collapsed ? label : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    collapsed ? 'justify-center' : ''
                  } ${
                    isActive
                      ? 'bg-teal-50 text-teal-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <Icon size={18} className="shrink-0" />
                {!collapsed && label}
              </NavLink>
            ))}
          </nav>
        )}

        {/* Wallet Button Section */}
        <div className={`border-t border-slate-200 shrink-0 ${collapsed ? 'py-3 flex justify-center' : 'p-4'}`}>
          {!collapsed && <WalletButton />}
          {collapsed && (
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center mx-auto">
              <span className="text-xs font-bold text-slate-600">₱</span>
            </div>
          )}
        </div>

        {/* Collapse Toggle Button - Fixed positioning */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center hover:bg-teal-50 hover:border-teal-300 transition-all duration-200 z-10"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight size={12} className="text-slate-500" />
          ) : (
            <ChevronLeft size={12} className="text-slate-500" />
          )}
        </button>
      </aside>

      {/* ── Main column ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile top bar */}
        <header className="lg:hidden shrink-0 bg-white border-b border-slate-200 h-14 flex items-center justify-between px-4 z-20">
          <div className="flex items-center gap-2 min-w-0 shrink-0">
            <img 
              src={logoImg} 
              alt="PalengkePay" 
              className="w-6 h-6 rounded-md object-cover shrink-0"
            />
            <span className="font-semibold text-sm" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              <span style={{ color: '#00284B' }}>Palengke</span>
              <span style={{ color: '#008055' }}>Pay</span>
            </span>
          </div>
          <div className="shrink-0 ml-3">
            <WalletButton />
          </div>
        </header>

        {/* Desktop top bar */}
        <header className="hidden lg:flex shrink-0 bg-white border-b border-slate-200 h-14 items-center justify-between px-6 z-20">
          {pageTitle ? (
            <h1 className="text-sm font-semibold text-slate-700">{pageTitle}</h1>
          ) : (
            <div />
          )}
          <WalletButton />
        </header>

        {/* Scrollable content */}
        <main ref={scrollRef as React.RefObject<HTMLElement>} className="flex-1 overflow-y-auto">
          <div key={pathname} className={`max-w-3xl mx-auto w-full px-4 lg:px-8 pt-6 animate-page-in ${navItems ? 'pb-24' : 'pb-6'}`}>
            <Outlet />
          </div>
        </main>
      </div>

      {/* ── Mobile bottom nav ───────────────────────────── */}
      {navItems && (
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 overflow-visible">
          <div className="flex h-16 items-center overflow-visible">
            {navItems.map((item) => {
              const { to, icon: Icon, label } = item;
              const isFab = 'center' in item && item.center;

              if (isFab) {
                return (
                  <NavLink
                    key={to}
                    to={to}
                    className="flex-1 flex flex-col items-center justify-center overflow-visible"
                  >
                    {({ isActive }) => (
                      <>
                        <div
                          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg -translate-y-5 border-4 border-white transition-colors ${
                            isActive ? 'bg-teal-600' : 'bg-teal-700'
                          }`}
                        >
                          <Icon size={22} className="text-white" />
                        </div>
                        <span className={`text-xs font-medium -mt-3.5 transition-colors ${isActive ? 'text-teal-700' : 'text-slate-400'}`}>
                          {label}
                        </span>
                      </>
                    )}
                  </NavLink>
                );
              }

              return (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors min-w-0 ${
                      isActive ? 'text-teal-700' : 'text-slate-400 hover:text-slate-600'
                    }`
                  }
                >
                  <Icon size={18} />
                  <span className="text-xs font-medium leading-tight">{label}</span>
                </NavLink>
              );
            })}
          </div>
        </nav>
      )}

      <ScrollToTop scrollRef={scrollRef as React.RefObject<HTMLElement | null>} />
    </div>
  );
}