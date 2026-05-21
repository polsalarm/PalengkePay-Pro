import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Home,
  QrCode,
  ScanLine,
  List,
  User,
  UserPlus,
  Users,
  HandCoins,
  ArrowUp,
} from 'lucide-react';
import { WalletButton } from './WalletButton';
import logoImg from '../assets/logo.png';
import { useLanguage } from '../contexts/LanguageContext';

const vendorNav = [
  { to: '/vendor/home', icon: Home, label: 'Home', center: false },
  { to: '/vendor/transactions', icon: List, label: 'History', center: false },
  { to: '/vendor/qr', icon: QrCode, label: 'My QR', center: true },
  { to: '/vendor/utang', icon: HandCoins, label: 'Utang', center: false },
  { to: '/vendor/profile', icon: User, label: 'Profile', center: false },
];

const customerNav = [
  { to: '/customer/home', icon: Home, label: 'Home', center: false },
  { to: '/customer/history', icon: List, label: 'History', center: false },
  { to: '/customer/scan', icon: ScanLine, label: 'Scan', center: true },
  { to: '/customer/utang', icon: HandCoins, label: 'Utang', center: false },
  { to: '/customer/profile', icon: User, label: 'Profile', center: false },
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
  '/customer/profile': 'Profile',
  '/market': 'Market Directory',
  '/admin/market': 'Market Dashboard',
  '/admin/register': 'Register Vendor',
  '/dashboard': 'Dashboard',
  '/vendor/apply': 'Apply as Vendor',
};

// Pages that should NOT have the container wrapper (full width)
const fullWidthPages = ['/vendor/qr', '/customer/scan'];

function useNavItems() {
  const { pathname } = useLocation();

  if (pathname.startsWith('/vendor')) return vendorNav;
  if (pathname.startsWith('/customer') || pathname === '/market') return customerNav;
  if (pathname.startsWith('/admin')) return adminNav;

  return null;
}

function ScrollToTop({
  scrollRef,
}: {
  scrollRef: React.RefObject<HTMLElement | null>;
}) {
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
      type="button"
      onClick={() =>
        scrollRef.current?.scrollTo({
          top: 0,
          behavior: 'smooth',
        })
      }
      className="fixed bottom-24 right-4 lg:bottom-8 lg:right-8 z-40 w-11 h-11 rounded-full bg-[#008055] hover:bg-[#006b48] active:scale-95 text-white shadow-lg flex items-center justify-center transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      aria-label="Scroll to top"
    >
      <ArrowUp size={16} aria-hidden="true" />
    </button>
  );
}

export function Layout() {
  const navItems = useNavItems();
  const { pathname } = useLocation();

  const [collapsed, setCollapsed] = useState(false);

  const scrollRef = useRef<HTMLElement>(null);

  // Keep /customer/scan as fullscreen so it handles its own UI
  const isFullscreen = pathname === '/onboard';

  const pageTitle = PAGE_TITLES[pathname] ?? '';

  const { lang, setLang } = useLanguage();

  const isFullWidthPage = fullWidthPages.includes(pathname);

  useEffect(() => {
    scrollRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  if (isFullscreen) {
    return <Outlet />;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[1000] focus:rounded-xl focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-black focus:text-[#008055] focus:shadow-lg focus:outline focus:outline-2 focus:outline-offset-2"
      >
        Skip to main content
      </a>

      {/* ── Desktop sidebar ─────────────────────────────── */}
      <aside
        className={`hidden lg:flex flex-col bg-white border-r border-slate-200 shrink-0 transition-all duration-300 relative ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        <div
          className={`flex items-center h-16 border-b border-slate-200 shrink-0 ${
            collapsed ? 'justify-center px-0' : 'gap-2.5 px-6'
          }`}
        >
          <img
            src={logoImg}
            alt="PalengkePay"
            className="w-7 h-7 rounded-lg object-cover shrink-0"
          />

          {!collapsed && (
            <span
              className="font-semibold"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              <span style={{ color: '#00284B' }}>Palengke</span>
              <span style={{ color: '#008055' }}>Pay</span>
            </span>
          )}
        </div>

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
                      ? 'bg-[#008055]/10 text-[#008055]'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <Icon
                  size={18}
                  aria-hidden="true"
                  className="shrink-0"
                />

                {!collapsed && label}
              </NavLink>
            ))}
          </nav>
        )}

        {/* Wallet Button Section removed */}
      </aside>

      {/* ── Main column ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile top bar */}
        <header className="lg:hidden shrink-0 bg-white border-b border-slate-200 h-14 flex items-center justify-between px-4 z-20">
          <div className="flex items-center min-w-0 shrink-0">
            <img
              src={logoImg}
              alt="PalengkePay"
              className="w-7 h-7 rounded-md object-cover shrink-0"
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-3">
            <div className="flex items-center rounded-full p-0.5 bg-slate-100">
              {(['en', 'tl'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full transition-all"
                  style={
                    lang === l
                      ? {
                          backgroundColor: '#008055',
                          color: 'white',
                        }
                      : {
                          color: '#64748B',
                        }
                  }
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Desktop top bar */}
        <header className="hidden lg:flex shrink-0 bg-white border-b border-slate-200 h-14 items-center justify-between px-6 z-20">
          {pageTitle ? (
            <h1 className="text-sm font-semibold text-slate-700">
              {pageTitle}
            </h1>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-full p-0.5 bg-slate-100">
              {(['en', 'tl'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className="text-xs font-bold px-3 py-1 rounded-full transition-all"
                  style={
                    lang === l
                      ? {
                          backgroundColor: '#008055',
                          color: 'white',
                        }
                      : {
                          color: '#64748B',
                        }
                  }
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Scrollable content */}
        <main
          id="main-content"
          ref={scrollRef as React.RefObject<HTMLElement>}
          tabIndex={-1}
          className="flex-1 overflow-y-auto outline-none"
        >
          <div
            key={pathname}
            className={
              isFullWidthPage
                ? 'w-full mx-auto p-0 animate-page-in'
                : `max-w-3xl mx-auto w-full px-4 lg:px-8 pt-6 animate-page-in ${
                    navItems ? 'pb-24' : 'pb-6'
                  }`
            }
          >
            <Outlet />
          </div>
        </main>
      </div>

      {/* ── Mobile bottom nav ───────────────────────────── */}
      {navItems && (
        <nav
          className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 overflow-visible"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
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
                            isActive
                              ? 'bg-[#008055]'
                              : 'bg-[#008055]'
                          }`}
                        >
                          <Icon
                            size={22}
                            aria-hidden="true"
                            className="text-white"
                          />
                        </div>

                        <span
                          className={`text-xs font-medium -mt-3.5 transition-colors ${
                            isActive
                              ? 'text-[#008055]'
                              : 'text-slate-400'
                          }`}
                        >
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
                      isActive
                        ? 'text-[#008055]'
                        : 'text-slate-400 hover:text-slate-600'
                    }`
                  }
                >
                  <Icon size={18} aria-hidden="true" />

                  <span className="text-xs font-medium leading-tight">
                    {label}
                  </span>
                </NavLink>
              );
            })}
          </div>
        </nav>
      )}

      <ScrollToTop
        scrollRef={scrollRef as React.RefObject<HTMLElement | null>}
      />
    </div>
  );
}