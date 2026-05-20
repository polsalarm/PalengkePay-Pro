import { useState, useRef, useEffect } from 'react';
import { Wallet, Copy, LogOut, Loader2, ChevronDown } from 'lucide-react';
import { useWallet } from '../lib/hooks/useWallet';
import { useFormatAmount } from '../lib/hooks/useDisplayUnit';
import { truncateAddress } from '../lib/stellar';

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

export function WalletButton() {
  const { address, balance, walletName, isConnected, isConnecting, connect, disconnect } = useWallet();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const badge = walletBadge(walletName);
  const { unit, format } = useFormatAmount();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
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
        onClick={connect}
        disabled={isConnecting}
        className="flex items-center gap-2 text-white text-sm font-bold px-4 py-2 rounded-xl transition-all active:scale-95 disabled:opacity-60"
        style={{ backgroundColor: '#008055', boxShadow: '0 2px 8px rgba(15,118,110,0.3)' }}
      >
        {isConnecting
          ? <Loader2 size={14} className="animate-spin" />
          : <Wallet size={14} />
        }
        {isConnecting ? 'Connecting…' : 'Connect Wallet'}
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      {/* Trigger pill */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm font-bold px-3 py-1.5 rounded-full transition-all active:scale-95 border"
        style={{
          backgroundColor: 'white',
          borderColor: open ? '#008055' : '#E2E8F0',
          color: '#334155',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}
      >
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#22C55E' }} />
        <span className="font-mono text-xs text-slate-600">{truncateAddress(address!)}</span>
        <ChevronDown
          size={13}
          className="transition-transform"
          style={{ color: '#94A3B8', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
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
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#4ADE80' }} />
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
                style={{ fontSize: '1.5rem', fontFamily: "'Montserrat', sans-serif" }}
              >
                {format(parseFloat(balance), { showSuffix: false })}
                <span className="text-sm font-semibold ml-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{unit === 'php' ? 'PHP' : 'XLM'}</span>
              </p>
            )}
          </div>

          {/* Address + actions */}
          <div className="bg-white p-3 space-y-2">
            <button
              onClick={copyAddress}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl transition-all active:scale-95 text-left"
              style={{ backgroundColor: '#F8FAFC' }}
            >
              <span className="font-mono text-xs text-slate-500 truncate flex-1">{address}</span>
              <span className="shrink-0 text-xs font-bold" style={{ color: copied ? '#16A34A' : '#008055' }}>
                {copied ? 'Copied!' : <Copy size={13} />}
              </span>
            </button>

            <button
              onClick={() => { disconnect(); setOpen(false); }}
              className="w-full flex items-center justify-center gap-2 text-sm font-bold py-2.5 rounded-xl transition-all active:scale-95"
              style={{ backgroundColor: '#FFF1F2', color: '#F43F5E' }}
            >
              <LogOut size={13} />
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
