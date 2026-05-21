import { useState } from 'react';
import { AlertTriangle, CheckCircle, Loader2, QrCode, ExternalLink, MapPin, Phone, Tag, Wallet } from 'lucide-react';
import { useWallet } from '../../lib/hooks/useWallet';
import { useApplyVendor } from '../../lib/hooks/useVendor';
import { useToast } from '../../lib/hooks/useToast';
import { truncateAddress } from '../../lib/stellar';
import { useLanguage } from '../../contexts/LanguageContext';

const PRODUCT_TYPES = ['fish', 'meat', 'vegetables', 'fruits', 'rice & grains', 'spices', 'other'];
const REGISTRY_ID = import.meta.env.VITE_VENDOR_REGISTRY_CONTRACT_ID as string | undefined;

const PRODUCT_META: Record<string, { emoji: string; color: string; bg: string }> = {
  fish:           { emoji: '🐟', color: '#2563EB', bg: '#EFF6FF' },
  meat:           { emoji: '🥩', color: '#DC2626', bg: '#FEF2F2' },
  vegetables:     { emoji: '🥦', color: '#16A34A', bg: '#F0FDF4' },
  fruits:         { emoji: '🍎', color: '#EA580C', bg: '#FFF7ED' },
  'rice & grains':{ emoji: '🌾', color: '#CA8A04', bg: '#FEFCE8' },
  spices:         { emoji: '🌶️', color: '#DB2777', bg: '#FDF2F8' },
  other:          { emoji: '🛒', color: '#475569', bg: '#F8FAFC' },
};

const OCCUPIED_STALLS = new Set([
  'A-1','A-3','A-5','A-8','A-10','A-13','A-16','A-19',
  'B-2','B-4','B-6','B-9','B-11','B-14','B-17','B-18',
  'C-1','C-4','C-7','C-10','C-15','C-18','C-20',
  'D-3','D-5','D-8','D-11','D-13','D-16','D-17','D-19',
]);

const SECTIONS = ['A', 'B', 'C', 'D'];
const STALLS_PER_SECTION = 20;

const SECTION_COLORS: Record<string, { active: string; text: string; ring: string }> = {
  A: { active: '#008055', text: 'white',   ring: '#14B8A6' },
  B: { active: '#D97706', text: 'white',   ring: '#FCD34D' },
  C: { active: '#042E80', text: 'white',   ring: '#C4B5FD' },
  D: { active: '#DB2777', text: 'white',   ring: '#FBCFE8' },
};

function StallPicker({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  const [section, setSection] = useState('A');
  const sc = SECTION_COLORS[section];

  return (
    <div className="space-y-3">
      {/* Section tabs */}
      <div className="grid grid-cols-4 gap-1.5 p-1 rounded-2xl" style={{ backgroundColor: '#F1F5F9' }}>
        {SECTIONS.map((s) => {
          const active = section === s;
          const c = SECTION_COLORS[s];
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSection(s)}
              className="py-2 text-xs font-black rounded-xl transition-all active:scale-95"
              style={active
                ? { backgroundColor: c.active, color: c.text, boxShadow: `0 2px 8px ${c.ring}66` }
                : { color: '#94A3B8' }
              }
            >
              Section {s}
            </button>
          );
        })}
      </div>

      {/* Stall grid */}
      <div className="grid grid-cols-5 gap-1.5">
        {Array.from({ length: STALLS_PER_SECTION }, (_, i) => {
          const stallId = `${section}-${i + 1}`;
          const occupied = OCCUPIED_STALLS.has(stallId);
          const selected = value === stallId;
          return (
            <button
              key={stallId}
              type="button"
              disabled={occupied}
              onClick={() => onChange(selected ? '' : stallId)}
              className="py-2.5 text-xs font-black rounded-xl transition-all active:scale-95"
              style={
                occupied
                  ? { backgroundColor: '#F1F5F9', color: '#CBD5E1', cursor: 'not-allowed' }
                  : selected
                  ? {
                      backgroundColor: sc.active,
                      color: sc.text,
                      boxShadow: `0 0 0 2px white, 0 0 0 4px ${sc.ring}`,
                    }
                  : {
                      backgroundColor: '#F8FAFC',
                      color: '#64748B',
                      border: '1.5px solid #E2E8F0',
                    }
              }
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4">
        {[
          { swatch: { backgroundColor: '#F8FAFC', border: '1.5px solid #E2E8F0' }, labelKey: 'Available' },
          { swatch: { backgroundColor: '#F1F5F9' }, labelKey: 'Occupied' },
          { swatch: { backgroundColor: sc.active }, labelKey: 'Selected' },
        ].map(({ swatch, labelKey }) => (
          <span key={labelKey} className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="w-3 h-3 rounded shrink-0" style={swatch} />
            <span>{labelKey}</span>
          </span>
        ))}
      </div>

      {/* Selected badge */}
      {value && (
        <div
          className="flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-black"
          style={{ backgroundColor: sc.active, color: sc.text }}
        >
          <MapPin size={14} />
          Stall {value} selected
        </div>
      )}
    </div>
  );
}

export function VendorApply() {
  const { address, isConnected, connect } = useWallet();
  const { apply, isSubmitting, error, txHash } = useApplyVendor();
  const { showToast } = useToast();
  const { t } = useLanguage();
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ name: '', stallNumber: '', productType: 'fish', phone: '' });

  const update = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) { connect(); return; }
    if (!REGISTRY_ID) { showToast(t('apply.registryNotConfigured'), 'error'); return; }
    if (!address) return;
    if (!form.stallNumber) { showToast(t('apply.selectStallError'), 'error'); return; }
    const ok = await apply(address, form.name, form.stallNumber, form.phone, form.productType);
    if (ok) {
      showToast(t('apply.successToast'), 'success');
      setDone(true);
    } else if (error) {
      showToast(error.slice(0, 100), 'error');
    }
  };

  const meta = PRODUCT_META[form.productType] ?? PRODUCT_META.other;

  /* ── Success state ── */
  if (done) {
    return (
      <div className="max-w-md mx-auto animate-page-in">
        <div className="rounded-3xl overflow-hidden" style={{ border: '1.5px solid #F1F5F9' }}>
          <div
            className="p-8 text-center relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #00284B 0%, #008055 100%)' }}
          >
            <div
              className="absolute pointer-events-none"
              style={{
                top: -60, right: -40, width: 200, height: 200, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(20,184,166,0.3) 0%, transparent 65%)',
                filter: 'blur(40px)',
              }}
            />
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 relative"
              style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
            >
              <CheckCircle size={40} className="text-white" />
            </div>
            <h2
              className="text-xl font-black text-white mb-1"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              {t('apply.successTitle')}
            </h2>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {t('apply.successDesc')}
            </p>
          </div>

          <div className="bg-white p-5 space-y-3">
            {/* Details card */}
            <div className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: '#F8FAFC' }}>
              <p className="text-xs font-black uppercase tracking-widest" style={{ color: '#94A3B8' }}>
                {t('apply.yourDetails')}
              </p>
              {[
                { icon: QrCode,  labelKey: 'stallName',  value: form.name },
                { icon: MapPin,  labelKey: 'stall',       value: form.stallNumber },
                { icon: Tag,     labelKey: 'product',     value: `${meta.emoji} ${form.productType}` },
                ...(form.phone ? [{ icon: Phone, labelKey: 'phone', value: form.phone }] : []),
              ].map(({ icon: Icon, labelKey, value }) => (
                <div key={labelKey} className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: '#F0FDFA' }}
                  >
                    <Icon size={13} style={{ color: '#008055' }} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">{t(`apply.${labelKey}`)}</p>
                    <p className="text-sm font-bold text-slate-800 capitalize">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {txHash && (
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-xs font-bold py-3 rounded-xl w-full active:scale-95"
                style={{ color: '#008055', backgroundColor: '#F0FDFA' }}
              >
                <ExternalLink size={13} /> {t('apply.viewOnExpert')}
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ── Application form ── */
  return (
    <div className="max-w-md mx-auto space-y-4 animate-page-in">

      {/* ── Hero ── */}
      <div className="relative rounded-3xl overflow-hidden" style={{ backgroundColor: '#00284B' }}>
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, white 0px, white 1px, transparent 1px, transparent 12px),
              repeating-linear-gradient(-45deg, white 0px, white 1px, transparent 1px, transparent 12px)`,
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            top: -50, right: -30, width: 200, height: 200, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(20,184,166,0.3) 0%, transparent 65%)',
            filter: 'blur(40px)',
          }}
        />
        <div className="relative p-5">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
          >
            <QrCode size={22} className="text-white" />
          </div>
          <h1
            className="text-xl font-black text-white mb-1"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            {t('apply.title')}
          </h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {t('apply.subtitle')}
          </p>

          {/* Wallet status */}
          <div
            className="mt-4 pt-4 flex items-center gap-2"
            style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
          >
            <Wallet size={13} style={{ color: isConnected ? '#4ADE80' : 'rgba(255,255,255,0.3)' }} />
            {isConnected && address ? (
              <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {truncateAddress(address)}
              </span>
            ) : (
              <button
                onClick={connect}
                className="text-xs font-bold px-3 py-1 rounded-full"
                style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: 'white' }}
              >
                {t('apply.connectWallet')}
              </button>
            )}
          </div>
        </div>
      </div>

      {!REGISTRY_ID && (
        <div
          className="rounded-2xl p-4 flex gap-3"
          style={{ backgroundColor: '#FFFBEB', border: '1.5px solid #FDE68A' }}
        >
          <AlertTriangle size={18} className="shrink-0 mt-0.5" style={{ color: '#D97706' }} />
          <div>
            <p className="text-sm font-black text-slate-800">{t('apply.registryNotConfigured')}</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {t('apply.registryHint')}
            </p>
          </div>
        </div>
      )}

      {/* ── Form ── */}
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Stall name */}
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
            {t('apply.stallNameLabel')}
          </label>
          <input
            type="text" required value={form.name} onChange={update('name')}
            placeholder={t('apply.stallNamePlaceholder')}
            className="w-full rounded-2xl px-4 py-3.5 text-sm font-semibold text-slate-800 focus:outline-none transition-all placeholder:font-normal placeholder:text-slate-300"
            style={{ border: '2px solid #E2E8F0' }}
            onFocus={(e) => { e.target.style.borderColor = '#008055'; }}
            onBlur={(e) => { e.target.style.borderColor = '#E2E8F0'; }}
          />
        </div>

        {/* Product type */}
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
            {t('apply.productTypeLabel')}
          </label>
          <div className="relative">
            <select
              value={form.productType} onChange={update('productType')}
              className="w-full rounded-2xl px-4 py-3.5 text-sm font-bold text-slate-800 focus:outline-none transition-all bg-white appearance-none pr-10"
              style={{ border: '2px solid #E2E8F0' }}
              onFocus={(e) => { e.target.style.borderColor = '#008055'; }}
              onBlur={(e) => { e.target.style.borderColor = '#E2E8F0'; }}
            >
              {PRODUCT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PRODUCT_META[t]?.emoji ?? ''} {t}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-lg pointer-events-none">
              {meta.emoji}
            </div>
          </div>
        </div>

        {/* Stall picker */}
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
            {t('apply.selectStallLabel')}
          </label>
          <div
            className="rounded-3xl p-4"
            style={{ border: '1.5px solid #F1F5F9', backgroundColor: 'white' }}
          >
            <StallPicker
              value={form.stallNumber}
              onChange={(stall) => setForm((prev) => ({ ...prev, stallNumber: stall }))}
            />
          </div>
        </div>

        {/* Phone */}
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
            {t('apply.phoneLabel')} <span className="font-normal normal-case text-slate-400">({t('apply.optional')})</span>
          </label>
          <input
            type="tel" value={form.phone} onChange={update('phone')}
            placeholder="+63917 XXX XXXX"
            className="w-full rounded-2xl px-4 py-3.5 text-sm font-semibold text-slate-800 focus:outline-none transition-all placeholder:font-normal placeholder:text-slate-300"
            style={{ border: '2px solid #E2E8F0' }}
            onFocus={(e) => { e.target.style.borderColor = '#008055'; }}
            onBlur={(e) => { e.target.style.borderColor = '#E2E8F0'; }}
          />
        </div>

        {/* Wallet address display */}
        {isConnected && address && (
          <div
            className="rounded-2xl px-4 py-3 flex items-center gap-3"
            style={{ backgroundColor: '#F8FAFC', border: '1.5px solid #F1F5F9' }}
          >
            <Wallet size={14} style={{ color: '#008055' }} className="shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-slate-400 mb-0.5">{t('apply.paymentWallet')}</p>
              <p className="text-xs font-mono text-slate-600 truncate">{address}</p>
            </div>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting || !isConnected || !REGISTRY_ID}
          className="w-full text-white font-black rounded-2xl active:scale-95 transition-all disabled:opacity-40"
          style={{
            backgroundColor: '#008055',
            minHeight: '60px',
            fontSize: '1.05rem',
            fontFamily: "'Montserrat', sans-serif",
            boxShadow: '0 6px 24px rgba(15,118,110,0.35)',
          }}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={18} className="animate-spin" /> {t('apply.submitting')}
            </span>
          ) : !REGISTRY_ID ? (
            t('apply.registryNotConfiguredShort')
          ) : !isConnected ? (
            t('apply.connectWallet')
          ) : (
            t('apply.submitButton')
          )}
        </button>
      </form>
    </div>
  );
}