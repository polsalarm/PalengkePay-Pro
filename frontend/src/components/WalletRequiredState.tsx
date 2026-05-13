import { ArrowRight, Wallet } from 'lucide-react';
import { useWallet } from '../lib/hooks/useWallet';

interface WalletRequiredStateProps {
  detail?: string;
  fullScreen?: boolean;
  tone?: 'light' | 'dark';
}

export function WalletRequiredState({
  detail = 'Connect your Stellar wallet to load this secure PalengkePay workspace.',
  fullScreen = false,
  tone = 'light',
}: WalletRequiredStateProps) {
  const { connect, isConnecting, error } = useWallet();
  const dark = tone === 'dark';

  return (
    <div
      className={`flex flex-col items-center justify-center px-6 text-center animate-page-in ${fullScreen ? 'min-h-screen' : 'min-h-[58vh]'}`}
      style={dark ? { backgroundColor: '#00284B' } : undefined}
    >
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5"
        style={{
          backgroundColor: dark ? 'rgba(255,255,255,0.1)' : '#F0FDFA',
          border: dark ? '1.5px solid rgba(255,255,255,0.14)' : '2px solid #CCFBF1',
        }}
      >
        <Wallet size={34} style={{ color: dark ? '#5EEAD4' : '#008055' }} />
      </div>
      <h2
        className={`text-xl font-black mb-2 ${dark ? 'text-white' : 'text-slate-900'}`}
        style={{ fontFamily: "'Montserrat', sans-serif" }}
      >
        Connect wallet to continue
      </h2>
      <p className={`text-sm max-w-sm mb-6 ${dark ? 'text-white/50' : 'text-slate-500'}`}>
        {detail}
      </p>
      {error && (
        <p
          className="text-xs font-semibold max-w-xs mb-4 px-3 py-2 rounded-xl"
          style={{
            color: '#BE123C',
            backgroundColor: dark ? 'rgba(255,241,242,0.95)' : '#FFF1F2',
            border: '1px solid #FECDD3',
          }}
        >
          {error}
        </p>
      )}
      <button
        onClick={connect}
        disabled={isConnecting}
        className="inline-flex items-center justify-center gap-2 text-white font-black rounded-2xl active:scale-95 transition-all disabled:opacity-60"
        style={{
          minHeight: '52px',
          minWidth: '220px',
          backgroundColor: '#008055',
          boxShadow: dark ? '0 10px 32px rgba(20,184,166,0.22)' : '0 6px 22px rgba(15,118,110,0.28)',
        }}
      >
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        {!isConnecting && <ArrowRight size={16} />}
      </button>
    </div>
  );
}
