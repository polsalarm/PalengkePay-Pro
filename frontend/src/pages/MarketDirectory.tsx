import { useState } from 'react';
import { Search, Store, RefreshCw, MapPin, Zap } from 'lucide-react';
import { useAllVendors } from '../lib/hooks/useVendor';
import type { VendorProfile } from '../lib/hooks/useVendor';

const PRODUCT_META: Record<string, { emoji: string; label: string; accent: string; bg: string; chipBg: string; chipColor: string }> = {
  fish:            { emoji: '🐟', label: 'Fish',          accent: '#2563EB', bg: '#EFF6FF', chipBg: '#DBEAFE', chipColor: '#1D4ED8' },
  meat:            { emoji: '🥩', label: 'Meat',          accent: '#DC2626', bg: '#FEF2F2', chipBg: '#FEE2E2', chipColor: '#B91C1C' },
  vegetables:      { emoji: '🥦', label: 'Vegetables',    accent: '#16A34A', bg: '#F0FDF4', chipBg: '#DCFCE7', chipColor: '#15803D' },
  fruits:          { emoji: '🍎', label: 'Fruits',        accent: '#EA580C', bg: '#FFF7ED', chipBg: '#FED7AA', chipColor: '#C2410C' },
  'rice & grains': { emoji: '🌾', label: 'Rice & Grains', accent: '#CA8A04', bg: '#FEFCE8', chipBg: '#FEF08A', chipColor: '#A16207' },
  spices:          { emoji: '🌶️', label: 'Spices',        accent: '#DB2777', bg: '#FDF2F8', chipBg: '#FBCFE8', chipColor: '#BE185D' },
  other:           { emoji: '🛒', label: 'Other',         accent: '#475569', bg: '#F8FAFC', chipBg: '#E2E8F0', chipColor: '#334155' },
};

const ALL_TYPES = ['all', 'fish', 'meat', 'vegetables', 'fruits', 'rice & grains', 'spices', 'other'] as const;
type SortMode = 'alphabetical' | 'most_active';

function VendorCard({ vendor }: { vendor: VendorProfile }) {
  const meta = PRODUCT_META[vendor.productType] ?? PRODUCT_META.other;

  return (
    <div
      className="rounded-3xl overflow-hidden transition-all active:scale-[0.97]"
      style={{
        border: '1.5px solid #F1F5F9',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
      }}
    >
      {/* Card header — product color bg */}
      <div
        className="px-4 pt-4 pb-3 flex items-start justify-between gap-2"
        style={{ backgroundColor: meta.bg }}
      >
        <span className="text-4xl leading-none select-none">{meta.emoji}</span>
        {vendor.isActive && (
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0"
            style={{ backgroundColor: '#DCFCE7', color: '#15803D' }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#22C55E' }} />
            Open
          </div>
        )}
      </div>

      {/* Card body — white */}
      <div className="bg-white px-4 py-3 space-y-2">
        <p
          className="font-black text-slate-900 leading-tight truncate"
          style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '0.9rem' }}
        >
          {vendor.name}
        </p>

        <div className="flex items-center gap-1.5">
          <MapPin size={10} style={{ color: '#94A3B8' }} className="shrink-0" />
          <p className="text-xs text-slate-400 truncate">Stall {vendor.stallNumber}</p>
        </div>

        <div className="flex items-center justify-between">
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize"
            style={{ backgroundColor: meta.chipBg, color: meta.chipColor }}
          >
            {meta.label}
          </span>
          {vendor.totalTransactions > 0 && (
            <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-0.5">
              <Zap size={9} style={{ color: '#FCD34D' }} />
              {vendor.totalTransactions}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-3xl overflow-hidden" style={{ border: '1.5px solid #F1F5F9' }}>
      <div className="px-4 pt-4 pb-3" style={{ backgroundColor: '#F8FAFC' }}>
        <div className="w-10 h-10 skeleton rounded-2xl" />
      </div>
      <div className="bg-white px-4 py-3 space-y-2">
        <div className="h-4 w-24 skeleton rounded" />
        <div className="h-3 w-16 skeleton rounded" />
        <div className="h-4 w-14 skeleton rounded-full" />
      </div>
    </div>
  );
}

export function MarketDirectory() {
  const { vendors, isLoading, error, refetch } = useAllVendors();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortMode, setSortMode] = useState<SortMode>('alphabetical');

  const active = vendors.filter((v) => v.isActive);

  const filtered = active
    .filter((v) => {
      const matchType = typeFilter === 'all' || v.productType === typeFilter;
      const q = query.toLowerCase();
      const matchQuery =
        !q ||
        v.name.toLowerCase().includes(q) ||
        v.stallNumber.toLowerCase().includes(q) ||
        v.productType.toLowerCase().includes(q);
      return matchType && matchQuery;
    })
    .sort((a, b) =>
      sortMode === 'most_active'
        ? b.totalTransactions - a.totalTransactions
        : a.name.localeCompare(b.name)
    );

  return (
    <div className="space-y-4 animate-page-in">

      {/* ── Hero bar ── */}
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
            top: -50, right: -30, width: 180, height: 180, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(20,184,166,0.3) 0%, transparent 65%)',
            filter: 'blur(40px)',
          }}
        />
        <div className="relative p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Palengke Directory
              </p>
              <p
                className="text-xl font-black text-white"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              >
                {isLoading ? '…' : active.length}
                <span className="text-sm font-semibold ml-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {isLoading ? '' : `vendor${active.length !== 1 ? 's' : ''} open`}
                </span>
              </p>
            </div>
            <button
              onClick={refetch}
              className="w-9 h-9 rounded-2xl flex items-center justify-center active:scale-95 transition-all"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} style={{ color: 'rgba(255,255,255,0.6)' }} />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.35)' }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Hanapin ang vendor, stall, o produkto…"
              className="w-full pl-9 pr-4 py-3 text-sm font-medium rounded-2xl focus:outline-none transition-all placeholder:font-normal"
              style={{
                backgroundColor: 'rgba(255,255,255,0.1)',
                color: 'white',
                border: '1.5px solid rgba(255,255,255,0.1)',
              }}
              onFocus={(e) => { e.target.style.borderColor = '#14B8A6'; e.target.style.backgroundColor = 'rgba(255,255,255,0.15)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.backgroundColor = 'rgba(255,255,255,0.1)'; }}
            />
          </div>
        </div>
      </div>

      {/* ── Filter chips ── */}
      <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
        {ALL_TYPES.map((t) => {
          const active = typeFilter === t;
          const meta = t !== 'all' ? PRODUCT_META[t] : null;
          return (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className="shrink-0 flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-full transition-all active:scale-95"
              style={active
                ? { backgroundColor: '#008055', color: 'white', boxShadow: '0 2px 8px rgba(15,118,110,0.3)' }
                : { backgroundColor: 'white', color: '#64748B', border: '1.5px solid #E2E8F0' }
              }
            >
              {meta && <span>{meta.emoji}</span>}
              {t === 'all' ? 'Lahat' : meta?.label ?? t}
            </button>
          );
        })}

        {/* Sort toggle */}
        <button
          onClick={() => setSortMode((s) => s === 'alphabetical' ? 'most_active' : 'alphabetical')}
          className="shrink-0 flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-full transition-all active:scale-95 ml-auto"
          style={sortMode === 'most_active'
            ? { backgroundColor: '#FFFBEB', color: '#D97706', border: '1.5px solid #FDE68A' }
            : { backgroundColor: 'white', color: '#94A3B8', border: '1.5px solid #E2E8F0' }
          }
        >
          <Zap size={11} />
          {sortMode === 'alphabetical' ? 'A–Z' : 'Most Active'}
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div
          className="rounded-2xl p-4 flex items-center justify-between gap-3"
          style={{ backgroundColor: '#FFF1F2', border: '1.5px solid #FECDD3' }}
        >
          <p className="text-sm font-semibold" style={{ color: '#F43F5E' }}>Failed to load vendors.</p>
          <button
            onClick={refetch}
            className="text-xs font-bold px-3 py-1.5 rounded-xl active:scale-95 text-white"
            style={{ backgroundColor: '#F43F5E' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Loading skeletons ── */}
      {isLoading && (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* ── Empty state ── */}
      {!isLoading && filtered.length === 0 && !error && (
        <div className="py-14 text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: '#F0FDFA', border: '1.5px solid #CCFBF1' }}
          >
            <Store size={28} style={{ color: '#008055' }} />
          </div>
          <p className="text-sm font-bold text-slate-700 mb-1" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            {query || typeFilter !== 'all' ? 'Walang nahanap' : 'Wala pang vendor'}
          </p>
          <p className="text-xs text-slate-400 mb-4">
            {query || typeFilter !== 'all' ? 'Subukan ng ibang search o filter' : 'Maging una sa palengke'}
          </p>
          {(query || typeFilter !== 'all') && (
            <button
              onClick={() => { setQuery(''); setTypeFilter('all'); }}
              className="text-xs font-bold px-4 py-2 rounded-xl active:scale-95 text-white"
              style={{ backgroundColor: '#008055' }}
            >
              I-clear ang filters
            </button>
          )}
        </div>
      )}

      {/* ── Vendor grid ── */}
      {!isLoading && filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((v) => (
            <VendorCard key={v.id} vendor={v} />
          ))}
        </div>
      )}
    </div>
  );
}
