import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Loader2, Send, Wallet, XCircle, CheckCircle2 } from 'lucide-react';
import { useWallet } from '../../lib/hooks/useWallet';
import { usePayment } from '../../lib/hooks/usePayment';
import { stellarExpertUrl, truncateAddress } from '../../lib/stellar';

const TEST_DESTINATION = 'GBI5W3JPFNGBMW2TCSGTNL3NPW6E423UN4BMAXAU34AXTSMTSDT2JDXH';
const TEST_AMOUNT = '0.1000000';

export function CustomerTestnetWallet() {
  const navigate = useNavigate();
  const { address, isConnected, isConnecting, connect, walletName } = useWallet();
  const { status, txHash, error, diagnostic, sendPayment, reset } = usePayment();
  const [connecting, setConnecting] = useState(false);

  const statusCopy = useMemo(() => {
    if (status === 'building') return 'Building Testnet transaction';
    if (status === 'signing') return 'Waiting for wallet signature';
    if (status === 'submitting') return 'Submitting to Stellar Testnet';
    return null;
  }, [status]);

  const handleConnect = async () => {
    setConnecting(true);
    try { await connect(); } finally { setConnecting(false); }
  };

  const handleSend = async () => {
    if (!address) return;
    reset();
    await sendPayment(address, TEST_DESTINATION, TEST_AMOUNT, 'wallet test');
  };

  return (
    <div className="space-y-4 animate-page-in max-w-md">
      <button onClick={() => navigate('/customer/profile')} className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
        <ArrowLeft size={14} /> Back
      </button>

      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#F0FDFA' }}>
          <Wallet size={20} style={{ color: '#008055' }} />
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>Testnet Wallet Check</h1>
          <p className="text-xs text-slate-400">Send a small XLM transfer and verify it on Stellar Expert</p>
        </div>
      </div>

      <div className="rounded-2xl bg-white border p-4 space-y-3" style={{ borderColor: '#F1F5F9' }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Network</p>
            <p className="text-sm font-bold text-slate-900 mt-1">Stellar Testnet</p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full" style={{ backgroundColor: '#F0FDFA', color: '#008055' }}>
            No fiat movement
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Metric label="Amount" value={`${TEST_AMOUNT} XLM`} />
          <Metric label="Memo" value="PP:wallet test" />
        </div>
        <div className="rounded-xl px-3 py-2" style={{ backgroundColor: '#F8FAFC' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Destination</p>
          <p className="font-mono text-[11px] text-slate-600 break-all mt-1">{TEST_DESTINATION}</p>
        </div>
      </div>

      {!isConnected && (
        <div className="rounded-2xl bg-white border p-4 space-y-3" style={{ borderColor: '#F1F5F9' }}>
          <p className="text-sm font-bold text-slate-900">Connect a Testnet wallet first</p>
          <p className="text-xs text-slate-500">This check signs one tiny Testnet transfer so judges can see a real Stellar transaction hash.</p>
          <button
            onClick={handleConnect}
            disabled={connecting || isConnecting}
            className="w-full min-h-11 rounded-2xl font-black text-white disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: '#008055', fontFamily: "'Montserrat', sans-serif" }}
          >
            {(connecting || isConnecting) && <Loader2 size={16} className="animate-spin" />}
            Connect wallet
          </button>
          <Link to="/connect" className="block text-center text-xs font-bold" style={{ color: '#008055' }}>Open wallet connection page</Link>
        </div>
      )}

      {isConnected && address && status !== 'confirmed' && status !== 'failed' && (
        <div className="rounded-2xl bg-white border p-4 space-y-3" style={{ borderColor: '#F1F5F9' }}>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Connected wallet</p>
          <p className="text-sm font-bold text-slate-900">{walletName ?? 'Stellar wallet'} · <span className="font-mono">{truncateAddress(address)}</span></p>
          {statusCopy && (
            <div className="rounded-xl px-3 py-2 flex items-center gap-2" style={{ backgroundColor: '#F8FAFC' }}>
              <Loader2 size={15} className="animate-spin" style={{ color: '#008055' }} />
              <p className="text-xs font-bold text-slate-600">{statusCopy}</p>
            </div>
          )}
          <button
            onClick={handleSend}
            disabled={status !== 'idle'}
            className="w-full min-h-11 rounded-2xl font-black text-white disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: '#008055', fontFamily: "'Montserrat', sans-serif" }}
          >
            <Send size={16} /> Send Testnet XLM
          </button>
        </div>
      )}

      {status === 'confirmed' && txHash && (
        <div className="rounded-2xl bg-white border p-5 text-center space-y-3" style={{ borderColor: '#F1F5F9' }}>
          <CheckCircle2 size={40} className="mx-auto" style={{ color: '#008055' }} />
          <p className="font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>Wallet test confirmed</p>
          <p className="font-mono text-[11px] text-slate-400 break-all">{txHash}</p>
          <a href={stellarExpertUrl(txHash)} target="_blank" rel="noopener noreferrer" className="min-h-11 rounded-2xl font-bold text-white flex items-center justify-center gap-2" style={{ backgroundColor: '#008055' }}>
            <ExternalLink size={15} /> View on Stellar Expert
          </a>
          <button onClick={reset} className="w-full py-2 text-xs text-slate-500 font-bold">Run again</button>
        </div>
      )}

      {status === 'failed' && (
        <div className="rounded-2xl bg-white border p-5 text-center space-y-3" style={{ borderColor: '#FECACA' }}>
          <XCircle size={40} className="mx-auto text-red-500" />
          <p className="font-black text-slate-900">Wallet test failed</p>
          <p className="text-xs text-red-500">{error ?? 'Transaction was not completed'}</p>
          {diagnostic && <p className="text-[11px] text-slate-400">{diagnostic}</p>}
          <button onClick={reset} className="w-full min-h-11 rounded-2xl font-bold" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>Try again</button>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl px-3 py-2" style={{ backgroundColor: '#F8FAFC' }}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-0.5 font-bold text-slate-800">{value}</p>
    </div>
  );
}
