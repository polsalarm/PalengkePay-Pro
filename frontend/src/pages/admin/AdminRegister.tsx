import { useState } from 'react';
import { UserPlus, CheckCircle, Loader2, AlertTriangle, ExternalLink, Wallet, ShieldCheck } from 'lucide-react';
import { useWallet } from '../../lib/hooks/useWallet';
import { useToast } from '../../lib/hooks/useToast';
import { truncateAddress, prepareContractTx, submitSorobanTx, addressToScVal, stringToScVal } from '../../lib/stellar';
import { StellarWalletsKit, Networks } from '@creit.tech/stellar-wallets-kit';

const REGISTRY_ID = import.meta.env.VITE_VENDOR_REGISTRY_CONTRACT_ID as string | undefined;
const PRODUCT_TYPES = ['fish', 'meat', 'vegetables', 'fruits', 'rice & grains', 'spices', 'other'];

const PRODUCT_META: Record<string, string> = {
  fish: '🐟', meat: '🥩', vegetables: '🥦', fruits: '🍎',
  'rice & grains': '🌾', spices: '🌶️', other: '🛒',
};

export function AdminRegister() {
  const { address, isConnected, connect } = useWallet();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [form, setForm] = useState({
    name: '', stallNumber: '', productType: 'fish',
    walletAddress: '', phone: '', marketId: 'marikina-public-market',
  });

  const update = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) { connect(); return; }
    if (!address) return;
    if (!form.walletAddress.startsWith('G') || form.walletAddress.length !== 56) {
      showToast('Invalid Stellar address — must start with G, 56 chars', 'error');
      return;
    }
    if (!REGISTRY_ID) {
      showToast('VendorRegistry contract not deployed', 'error');
      return;
    }
    setLoading(true);
    try {
      const xdr = await prepareContractTx(address, REGISTRY_ID, 'register_vendor', [
        addressToScVal(address),
        addressToScVal(form.walletAddress),
        stringToScVal(form.marketId),
        stringToScVal(form.name),
        stringToScVal(form.stallNumber),
        stringToScVal(form.phone),
        stringToScVal(form.productType),
      ]);
      const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, { networkPassphrase: Networks.TESTNET, address });
      const hash = await submitSorobanTx(signedTxXdr);
      setTxHash(hash);
      showToast(`${form.name} registered on-chain!`, 'success');
      setDone(true);
    } catch (err: unknown) {
      showToast(((err as { message?: string }).message ?? 'Registration failed').slice(0, 100), 'error');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setDone(false); setTxHash('');
    setForm({ name: '', stallNumber: '', productType: 'fish', walletAddress: '', phone: '', marketId: 'marikina-public-market' });
  };

  /* ── Contract not deployed ── */
  if (!REGISTRY_ID) {
    return (
      <div className="max-w-md mx-auto animate-page-in">
        <div
          className="rounded-3xl p-5 flex items-start gap-4"
          style={{ backgroundColor: '#FFFBEB', border: '1.5px solid #FDE68A' }}
        >
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#FEF3C7' }}>
            <AlertTriangle size={18} style={{ color: '#D97706' }} />
          </div>
          <div>
            <p className="text-sm font-black" style={{ color: '#92400E', fontFamily: "'Syne', sans-serif" }}>
              Contract not deployed
            </p>
            <p className="text-xs mt-1" style={{ color: '#D97706' }}>
              Set <code className="font-mono bg-amber-100 px-1 rounded">VITE_VENDOR_REGISTRY_CONTRACT_ID</code> in{' '}
              <code className="font-mono bg-amber-100 px-1 rounded">.env.local</code>
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ── Success ── */
  if (done) {
    return (
      <div className="max-w-md mx-auto animate-page-in">
        <div className="rounded-3xl overflow-hidden" style={{ border: '1.5px solid #F1F5F9' }}>
          <div
            className="p-8 text-center relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #0A3D38 0%, #0F766E 100%)' }}
          >
            <div
              className="absolute pointer-events-none"
              style={{ top: -50, right: -30, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(20,184,166,0.3) 0%, transparent 65%)', filter: 'blur(40px)' }}
            />
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 relative" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
              <CheckCircle size={40} className="text-white" />
            </div>
            <h2 className="text-xl font-black text-white mb-1" style={{ fontFamily: "'Syne', sans-serif" }}>
              Vendor Registered!
            </h2>
            <p className="text-sm font-bold mt-1" style={{ color: 'rgba(255,255,255,0.7)' }}>{form.name}</p>
            <p className="text-xs font-mono mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{truncateAddress(form.walletAddress)}</p>
          </div>
          <div className="bg-white p-5 space-y-3">
            {txHash && (
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-xs font-bold py-3 rounded-xl w-full active:scale-95"
                style={{ color: '#0F766E', backgroundColor: '#F0FDFA' }}
              >
                <ExternalLink size={13} /> View on Stellar Expert
              </a>
            )}
            <button
              onClick={reset}
              className="w-full font-black rounded-2xl active:scale-95 text-white"
              style={{ backgroundColor: '#0F766E', minHeight: '52px', fontFamily: "'Syne', sans-serif" }}
            >
              Register Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Form ── */
  return (
    <div className="max-w-md mx-auto space-y-4 animate-page-in">

      {/* Hero */}
      <div className="relative rounded-3xl overflow-hidden" style={{ backgroundColor: '#0A3D38' }}>
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, white 0px, white 1px, transparent 1px, transparent 12px),
              repeating-linear-gradient(-45deg, white 0px, white 1px, transparent 1px, transparent 12px)`,
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{ top: -50, right: -30, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(20,184,166,0.3) 0%, transparent 65%)', filter: 'blur(40px)' }}
        />
        <div className="relative p-5">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
            <ShieldCheck size={22} className="text-white" />
          </div>
          <h1 className="text-xl font-black text-white mb-1" style={{ fontFamily: "'Syne', sans-serif" }}>
            Register Vendor
          </h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Direct on-chain registration via VendorRegistry contract.
          </p>
          <div className="mt-4 pt-4 flex items-center gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <Wallet size={13} style={{ color: isConnected ? '#4ADE80' : 'rgba(255,255,255,0.3)' }} />
            {isConnected && address
              ? <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.5)' }}>{truncateAddress(address)}</span>
              : <button onClick={connect} className="text-xs font-bold px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: 'white' }}>Connect Wallet</button>
            }
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-3">

        {[
          { label: 'Vendor Name', key: 'name' as const, type: 'text', placeholder: 'e.g. Aling Nena', required: true },
          { label: 'Phone', key: 'phone' as const, type: 'tel', placeholder: '+63917…', required: false },
          { label: 'Market ID', key: 'marketId' as const, type: 'text', placeholder: 'marikina-public-market', required: true },
        ].map(({ label, key, type, placeholder, required }) => (
          <div key={key}>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">{label}</label>
            <input
              type={type} required={required} value={form[key]} onChange={update(key)} placeholder={placeholder}
              className="w-full rounded-2xl px-4 py-3.5 text-sm font-semibold text-slate-800 focus:outline-none transition-all placeholder:font-normal placeholder:text-slate-300"
              style={{ border: '2px solid #E2E8F0' }}
              onFocus={(e) => { e.target.style.borderColor = '#0F766E'; }}
              onBlur={(e) => { e.target.style.borderColor = '#E2E8F0'; }}
            />
          </div>
        ))}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Stall No.</label>
            <input
              type="text" required value={form.stallNumber} onChange={update('stallNumber')} placeholder="e.g. B-14"
              className="w-full rounded-2xl px-4 py-3.5 text-sm font-semibold text-slate-800 focus:outline-none transition-all placeholder:font-normal placeholder:text-slate-300"
              style={{ border: '2px solid #E2E8F0' }}
              onFocus={(e) => { e.target.style.borderColor = '#0F766E'; }}
              onBlur={(e) => { e.target.style.borderColor = '#E2E8F0'; }}
            />
          </div>
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Product Type</label>
            <div className="relative">
              <select
                value={form.productType} onChange={update('productType')}
                className="w-full rounded-2xl px-4 py-3.5 text-sm font-bold text-slate-800 focus:outline-none transition-all bg-white appearance-none"
                style={{ border: '2px solid #E2E8F0' }}
                onFocus={(e) => { e.target.style.borderColor = '#0F766E'; }}
                onBlur={(e) => { e.target.style.borderColor = '#E2E8F0'; }}
              >
                {PRODUCT_TYPES.map((t) => <option key={t} value={t}>{PRODUCT_META[t]} {t}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Vendor Wallet Address</label>
          <input
            type="text" required value={form.walletAddress} onChange={update('walletAddress')} placeholder="G… (56 characters)"
            className="w-full rounded-2xl px-4 py-3.5 text-sm font-mono text-slate-800 focus:outline-none transition-all placeholder:font-sans placeholder:font-normal placeholder:text-slate-300"
            style={{ border: '2px solid #E2E8F0' }}
            onFocus={(e) => { e.target.style.borderColor = '#0F766E'; }}
            onBlur={(e) => { e.target.style.borderColor = '#E2E8F0'; }}
          />
        </div>

        <button
          type="submit" disabled={loading || !isConnected}
          className="w-full text-white font-black rounded-2xl active:scale-95 transition-all disabled:opacity-40"
          style={{ backgroundColor: '#0F766E', minHeight: '60px', fontSize: '1.05rem', fontFamily: "'Syne', sans-serif", boxShadow: '0 6px 24px rgba(15,118,110,0.35)' }}
        >
          {loading
            ? <span className="flex items-center justify-center gap-2"><Loader2 size={18} className="animate-spin" /> Submitting on-chain…</span>
            : <span className="flex items-center justify-center gap-2"><UserPlus size={18} /> Register Vendor</span>
          }
        </button>
      </form>
    </div>
  );
}
