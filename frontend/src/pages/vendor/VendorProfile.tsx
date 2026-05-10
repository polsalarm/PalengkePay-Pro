import { useState, useEffect } from 'react';
import { Edit2, Check, X, Loader2, MapPin, Tag, Phone, BarChart2, Coins } from 'lucide-react';
import { useWallet } from '../../lib/hooks/useWallet';
import { useVendor } from '../../lib/hooks/useVendor';
import { useToast } from '../../components/Toast';
import { truncateAddress, prepareContractTx, submitSorobanTx, addressToScVal, stringToScVal } from '../../lib/stellar';
import { StellarWalletsKit, Networks } from '@creit.tech/stellar-wallets-kit';

const REGISTRY_ID = import.meta.env.VITE_VENDOR_REGISTRY_CONTRACT_ID as string | undefined;
const PRODUCT_TYPES = ['fish', 'meat', 'vegetables', 'fruits', 'rice & grains', 'spices', 'other'];

const PRODUCT_EMOJIS: Record<string, string> = {
  fish: '🐟', meat: '🥩', vegetables: '🥦', fruits: '🍎',
  'rice & grains': '🌾', spices: '🌶️', other: '🛒',
};

export function VendorProfile() {
  const { address } = useWallet();
  const { vendor, isLoading } = useVendor(address);
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', stallNumber: '', phone: '', productType: 'fish' });

  useEffect(() => {
    if (vendor) setForm({ name: vendor.name, stallNumber: vendor.stallNumber, phone: vendor.phone, productType: vendor.productType });
  }, [vendor]);

  const update = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!address || !REGISTRY_ID) return;
    setSaving(true);
    try {
      const xdr = await prepareContractTx(address, REGISTRY_ID, 'update_profile', [
        addressToScVal(address),
        stringToScVal(form.name),
        stringToScVal(form.stallNumber),
        stringToScVal(form.phone),
        stringToScVal(form.productType),
      ]);
      const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, { networkPassphrase: Networks.TESTNET, address });
      await submitSorobanTx(signedTxXdr);
      showToast('Profile updated!', 'success');
      setEditing(false);
    } catch (err: unknown) {
      showToast((err as { message?: string }).message ?? 'Update failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const emoji = vendor ? (PRODUCT_EMOJIS[vendor.productType] ?? '🛒') : '🛒';

  return (
    <div className="space-y-4 animate-page-in max-w-md">

      {/* ── PROFILE HERO ── */}
      <div className="relative rounded-3xl overflow-hidden" style={{ backgroundColor: '#0A3D38' }}>
        <div
          className="absolute pointer-events-none"
          style={{
            top: -40, right: -40, width: 200, height: 200, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(20,184,166,0.28) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
        <div
          className="absolute select-none pointer-events-none font-black"
          style={{
            fontSize: '11rem', lineHeight: 1, color: 'rgba(255,255,255,0.03)',
            bottom: -16, right: 0,
            fontFamily: "'Syne', sans-serif",
          }}
        >₱</div>

        <div className="relative p-6">
          {isLoading ? (
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl skeleton shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-5 w-36 skeleton rounded" />
                <div className="h-3 w-24 skeleton rounded" />
                <div className="h-3 w-32 skeleton rounded" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shrink-0"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                {emoji}
              </div>
              <div className="min-w-0">
                <p
                  className="font-black text-white text-xl leading-tight truncate"
                  style={{ fontFamily: "'Syne', sans-serif" }}
                >{vendor?.name || 'Vendor'}</p>
                <p className="text-xs font-medium capitalize mt-0.5" style={{ color: '#14B8A6' }}>
                  {vendor?.productType || ''}
                </p>
                {address && (
                  <p className="text-xs font-mono mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {truncateAddress(address)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Status badge */}
          {vendor && (
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <span
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full"
                style={vendor.isActive
                  ? { backgroundColor: 'rgba(74,222,128,0.15)', color: '#4ADE80' }
                  : { backgroundColor: 'rgba(248,113,113,0.15)', color: '#F87171' }
                }
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${vendor.isActive ? 'animate-pulse' : ''}`}
                  style={{ backgroundColor: vendor.isActive ? '#4ADE80' : '#F87171' }}
                />
                {vendor.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── STATS ── */}
      {vendor && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#F0FDFA' }}>
                <BarChart2 size={15} style={{ color: '#0F766E' }} />
              </div>
              <span className="text-xs text-slate-500 font-medium">Transactions</span>
            </div>
            <p className="text-3xl font-black text-slate-900" style={{ fontFamily: "'Syne', sans-serif" }}>
              {vendor.totalTransactions}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#FFFBEB' }}>
                <Coins size={15} style={{ color: '#D97706' }} />
              </div>
              <span className="text-xs text-slate-500 font-medium">Volume</span>
            </div>
            <p className="text-3xl font-black text-slate-900" style={{ fontFamily: "'Syne', sans-serif" }}>
              {(Number(vendor.totalVolume) / 10_000_000).toFixed(1)}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">XLM</p>
          </div>
        </div>
      )}

      {/* ── STALL DETAILS ── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-black text-slate-900" style={{ fontFamily: "'Syne', sans-serif" }}>
            Stall Details
          </h2>
          {!editing && vendor && REGISTRY_ID && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 text-xs font-bold transition-colors"
              style={{ color: '#0F766E' }}
            >
              <Edit2 size={12} /> Edit
            </button>
          )}
        </div>

        <div className="p-5">
          {isLoading && (
            <div className="space-y-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl skeleton shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 w-16 skeleton rounded" />
                    <div className="h-3.5 w-28 skeleton rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && !vendor && (
            <p className="text-sm text-slate-400 py-2">
              {REGISTRY_ID ? 'Not registered as vendor.' : 'VendorRegistry contract not deployed.'}
            </p>
          )}

          {!isLoading && vendor && editing && (
            <div className="space-y-4">
              {[
                { label: 'Vendor Name', key: 'name' as const, type: 'text', placeholder: 'e.g. Aling Nena' },
                { label: 'Stall Number', key: 'stallNumber' as const, type: 'text', placeholder: 'e.g. Stall 14' },
                { label: 'Phone', key: 'phone' as const, type: 'tel', placeholder: '09XX XXX XXXX' },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">{label}</label>
                  <input
                    type={type}
                    value={form[key]}
                    onChange={update(key)}
                    placeholder={placeholder}
                    className="w-full border rounded-xl px-4 py-2.5 text-sm text-slate-900 transition-all outline-none"
                    style={{ borderColor: '#E2E8F0' }}
                    onFocus={e => e.target.style.borderColor = '#0F766E'}
                    onBlur={e => e.target.style.borderColor = '#E2E8F0'}
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Product Type</label>
                <select
                  value={form.productType}
                  onChange={update('productType')}
                  className="w-full border rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white outline-none transition-all"
                  style={{ borderColor: '#E2E8F0' }}
                  onFocus={e => e.target.style.borderColor = '#0F766E'}
                  onBlur={e => e.target.style.borderColor = '#E2E8F0'}
                >
                  {PRODUCT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 text-white font-bold py-2.5 rounded-xl text-sm transition-all active:scale-95 disabled:opacity-50"
                  style={{ backgroundColor: '#0F766E' }}
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  disabled={saving}
                  className="px-4 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl text-sm transition-all active:scale-95"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {!isLoading && vendor && !editing && (
            <div className="space-y-1">
              {[
                { icon: MapPin, label: 'Stall', value: vendor.stallNumber || '—', color: '#0F766E', bg: '#F0FDFA' },
                { icon: Tag,    label: 'Product', value: vendor.productType || '—', color: '#7C3AED', bg: '#F5F3FF' },
                { icon: Phone,  label: 'Phone', value: vendor.phone || '—', color: '#D97706', bg: '#FFFBEB' },
              ].map(({ icon: Icon, label, value, color, bg }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 py-3 px-2 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: bg }}
                  >
                    <Icon size={15} style={{ color }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400 font-medium">{label}</p>
                    <p className="text-sm font-semibold text-slate-800 capitalize truncate">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
