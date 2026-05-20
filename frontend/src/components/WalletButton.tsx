import { useState, useRef, useEffect } from 'react';
import { Wallet, Copy, LogOut, Loader2, ChevronDown } from 'lucide-react';
import { useWallet } from '../lib/hooks/useWallet';

const WALLET_BADGES: Record<string, { label: string; bg: string; color: string }> = {
  freighter:     { label: 'Freighter',     bg: '#EEF2FF', color: '#4F46E5' },
  lobstr:        { label: 'LOBSTR',        bg: '#EFF6FF', color: '#2563EB' },
  xbull:         { label: 'xBull',         bg: '#F5F3FF', color: '#042E80' },
  albedo:        { label: 'Albedo',        bg: '#FFF7ED', color: '#EA580C' },
  walletconnect: { label: 'WalletConnect', bg: '#F1F5F9', color: '#475569' },
};

function walletBadge(name: string | null) {
  if (!name) return null;
  const key = name.toLowerCase().replace(/\s+/g, '');
  return WALLET_BADGES[key] ?? { label: name, bg: '#F1F5F9', color: '#475569' };
}

function shortenAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletButton() {
  const { address, balance, walletName, isConnected, isConnecting, connect, disconnect } = useWallet();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const badge = walletBadge(walletName);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const copyAddress = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isConnected) {
    return (
      <button
        type="button"
        onClick={connect}
        disabled={isConnecting}
        className="flex min-h-11 items-center gap-2 text-white text-sm font-bold px-4 rounded-xl transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        aria-busy={isConnecting}
        style={{ backgroundColor: '#008055', boxShadow: '0 2px 8px rgba(15,118,110,0.3)' }}
      >
        {isConnecting
          ? <Loader2 size={14} aria-hidden="true" className="animate-spin" />
          : <Wallet size={14} aria-hidden="true" />
        }
        {isConnecting ? 'Connecting…' : 'Connect Wallet'}
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      {/* Trigger pill */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex min-h-11 items-center gap-2 text-sm font-bold px-3 rounded-full transition-all active:scale-95 border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Wallet menu for ${shortenAddress(address!)}`}
        style={{
          backgroundColor: 'white',
          borderColor: open ? '#008055' : '#E2E8F0',
          color: '#334155',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}
      >
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#22C55E' }} />
        <span className="font-mono text-xs text-slate-600">{shortenAddress(address!)}</span>
        <ChevronDown
          size={13}
          aria-hidden="true"
          className="transition-transform"
          style={{ color: '#94A3B8', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="menu"
          aria-label="Wallet actions"
          className="absolute right-0 top-full mt-2 z-50 overflow-hidden"
          style={{
            width: 280,
            borderRadius: 20,
            border: '1.5px solid #F1F5F9',
            boxShadow: '0 16px 48px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)',
          }}
        >
          {/* Header — dark teal */}
          <div className="p-4" style={{ backgroundColor: '#00284B' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#4ADE80' }} />
                <span className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Connected
                </span>
              </div>
              {badge && (
                <span
                  className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                  style={{ backgroundColor: badge.bg, color: badge.color }}
                >
                  {badge.label}
                </span>
              )}
            </div>

            {balance !== null && (
              <p
                className="font-black text-white leading-none mb-1"
                style={{ fontSize: '1.5rem', fontFamily: "'Montserrat', sans-serif', letterSpacing: '-0.02em'" }}
              >
                {parseFloat(balance).toFixed(2)}
                <span className="text-sm font-semibold ml-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>XLM</span>
              </p>
            )}
          </div>

          {/* Address + actions */}
          <div className="bg-white p-3 space-y-2">
            <button
              type="button"
              onClick={copyAddress}
              className="w-full flex min-h-11 items-center justify-between gap-2 px-3 rounded-xl transition-all active:scale-95 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              role="menuitem"
              aria-label="Copy wallet address"
              style={{ backgroundColor: '#F8FAFC' }}
            >
              <span className="font-mono text-xs text-slate-500 truncate flex-1">{address}</span>
              <span className="shrink-0 text-xs font-bold" style={{ color: copied ? '#16A34A' : '#008055' }}>
                {copied ? 'Copied!' : <Copy size={13} aria-hidden="true" />}
              </span>
            </button>
            <p className="sr-only" role="status" aria-live="polite">
              {copied ? 'Wallet address copied.' : ''}
            </p>

            <button
              type="button"
              onClick={() => { disconnect(); setOpen(false); }}
              className="w-full flex min-h-11 items-center justify-center gap-2 text-sm font-bold rounded-xl transition-all active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              role="menuitem"
              style={{ backgroundColor: '#FFF1F2', color: '#F43F5E' }}
            >
              <LogOut size={13} aria-hidden="true" />
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
