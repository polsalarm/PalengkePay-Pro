import { useMemo, useState } from 'react';
import { Search, Store, RefreshCw, MapPin, Zap, Star } from 'lucide-react';
import { useAllVendors } from '../lib/hooks/useVendor';
import type { VendorProfile } from '../lib/hooks/useVendor';
import { useBulkVendorStatuses } from '../lib/hooks/useVendorStatus';
import type { VendorStatus } from '../lib/vendorStatus';
import { useBulkVendorRatings } from '../lib/hooks/useRating';
import type { RatingSummary } from '../lib/rating';

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
type SortMode = 'alphabetical' | 'most_active' | 'top_rated';

function VendorCard({ vendor, status, rating }: { vendor: VendorProfile; status: VendorStatus | undefined; rating: RatingSummary | undefined }) {
  const meta = PRODUCT_META[vendor.productType] ?? PRODUCT_META.other;
  const isOpen = status?.isOpen ?? true;

  return (
    <div
      className="rounded-3xl overflow-hidden transition-all active:scale-[0.97]"
      style={{
        border: '1.5px solid #F1F5F9',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        opacity: isOpen ? 1 : 0.7,
      }}
    >
      {/* Card header — product color bg */}
      <div
        className="px-4 pt-4 pb-3 flex items-start justify-between gap-2"
        style={{ backgroundColor: meta.bg }}
      >
        <span className="text-4xl leading-none select-none">{meta.emoji}</span>
        <div
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0"
          style={isOpen
            ? { backgroundColor: '#DCFCE7', color: '#15803D' }
            : { backgroundColor: '#FEE2E2', color: '#B91C1C' }
          }
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'animate-pulse' : ''}`}
            style={{ backgroundColor: isOpen ? '#22C55E' : '#F43F5E' }}
          />
          {isOpen ? 'Open' : 'Closed'}
        </div>
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

        <div className="flex items-center justify-between gap-2">
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize shrink-0"
            style={{ backgroundColor: meta.chipBg, color: meta.chipColor }}
          >
            {meta.label}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {rating && rating.count > 0 && (
              <span className="text-[10px] font-bold flex items-center gap-0.5" style={{ color: '#CA8A04' }}>
                <Star size={9} fill="#FACC15" style={{ color: '#FACC15' }} />
                {rating.average.toFixed(1)}
                <span className="text-slate-400 font-medium ml-0.5">({rating.count})</span>
              </span>
            )}
            {vendor.totalTransactions > 0 && (
              <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-0.5">
                <Zap size={9} style={{ color: '#FCD34D' }} />
                {vendor.totalTransactions}
              </span>
            )}
          </div>
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

type MinRating = 0 | 3 | 4 | 5;

function sectionOf(stallNumber: string): string {
  const match = stallNumber.trim().match(/^([A-Za-z]+)/);
  return match ? match[1].toUpperCase() : '?';
}

export function MarketDirectory() {
  const { vendors, isLoading, error, refetch } = useAllVendors();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortMode, setSortMode] = useState<SortMode>('alphabetical');
  const [openOnly, setOpenOnly] = useState(false);
  const [minRating, setMinRating] = useState<MinRating>(0);
  const [section, setSection] = useState<string>('all');

  const active = vendors.filter((v) => v.isActive);
  const addresses = useMemo(() => active.map((v) => v.wallet).filter(Boolean), [active]);
  const { statuses } = useBulkVendorStatuses(addresses);
  const { summaries: ratings } = useBulkVendorRatings(addresses);

  const sections = useMemo(() => {
    const set = new Set<string>();
    for (const v of active) set.add(sectionOf(v.stallNumber));
    return Array.from(set).sort();
  }, [active]);

  const filtered = active
    .filter((v) => {
      const matchType = typeFilter === 'all' || v.productType === typeFilter;
      const q = query.toLowerCase();
      const matchQuery =
        !q ||
        v.name.toLowerCase().includes(q) ||
        v.stallNumber.toLowerCase().includes(q) ||
        v.productType.toLowerCase().includes(q);
      const s = statuses.get(v.wallet);
      const isOpen = s?.isOpen ?? true;
      const matchOpen = !openOnly || isOpen;
      const r = ratings.get(v.wallet);
      const avg = r?.count ? r.average : 0;
      const matchRating = minRating === 0 || (r?.count ?? 0) > 0 && avg >= minRating;
      const matchSection = section === 'all' || sectionOf(v.stallNumber) === section;
      return matchType && matchQuery && matchOpen && matchRating && matchSection;
    })
    .sort((a, b) => {
      if (sortMode === 'most_active') return b.totalTransactions - a.totalTransactions;
      if (sortMode === 'top_rated') {
        const ra = ratings.get(a.wallet);
        const rb = ratings.get(b.wallet);
        const avgA = ra?.count ? ra.average : -1;
        const avgB = rb?.count ? rb.average : -1;
        if (avgA !== avgB) return avgB - avgA;
        return (rb?.count ?? 0) - (ra?.count ?? 0);
      }
      return a.name.localeCompare(b.name);
    });

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

          {/* Open-only toggle (inside hero) */}
          <button
            onClick={() => setOpenOnly((v) => !v)}
            className="mt-3 w-full flex items-center justify-between rounded-2xl px-4 py-2.5 text-xs font-bold active:scale-[0.99] transition-all"
            style={openOnly
              ? {
                  backgroundColor: 'rgba(34,197,94,0.18)',
                  color: '#86EFAC',
                  border: '1.5px solid rgba(34,197,94,0.45)',
                }
              : {
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.65)',
                  border: '1.5px solid rgba(255,255,255,0.1)',
                }
            }
          >
            <span className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${openOnly ? 'animate-pulse' : ''}`}
                style={{ backgroundColor: openOnly ? '#22C55E' : 'rgba(255,255,255,0.35)' }}
              />
              {openOnly ? 'Showing open stalls only' : 'Show open stalls only'}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-black"
              style={openOnly
                ? { backgroundColor: '#22C55E', color: '#052E16' }
                : { backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)' }
              }
            >
              {openOnly ? 'ON' : 'OFF'}
            </span>
          </button>
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

        {/* Sort toggle — cycles alphabetical → most_active → top_rated */}
        <button
          onClick={() => setSortMode((s) =>
            s === 'alphabetical' ? 'most_active'
            : s === 'most_active' ? 'top_rated'
            : 'alphabetical'
          )}
          className="shrink-0 flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-full transition-all active:scale-95 ml-auto"
          style={
            sortMode === 'most_active' ? { backgroundColor: '#FFFBEB', color: '#D97706', border: '1.5px solid #FDE68A' }
            : sortMode === 'top_rated' ? { backgroundColor: '#FEFCE8', color: '#CA8A04', border: '1.5px solid #FEF08A' }
            : { backgroundColor: 'white', color: '#94A3B8', border: '1.5px solid #E2E8F0' }
          }
        >
          {sortMode === 'top_rated' ? <Star size={11} fill="#FACC15" style={{ color: '#FACC15' }} />
            : <Zap size={11} />}
          {sortMode === 'alphabetical' ? 'A–Z'
            : sortMode === 'most_active' ? 'Most Active'
            : 'Top Rated'}
        </button>
      </div>

      {/* ── Section + rating row ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
        {/* Section dropdown */}
        <div className="relative shrink-0">
          <select
            value={section}
            onChange={(e) => setSection(e.target.value)}
            className="appearance-none text-xs font-bold pl-3.5 pr-8 py-2 rounded-full transition-all cursor-pointer focus:outline-none"
            style={section === 'all'
              ? { backgroundColor: 'white', color: '#64748B', border: '1.5px solid #E2E8F0' }
              : { backgroundColor: '#EEF2FF', color: '#4338CA', border: '1.5px solid #C7D2FE' }
            }
          >
            <option value="all">All sections</option>
            {sections.map((s) => (
              <option key={s} value={s}>Section {s}</option>
            ))}
          </select>
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] pointer-events-none"
            style={{ color: section === 'all' ? '#94A3B8' : '#4338CA' }}
          >▼</span>
        </div>

        {/* Min rating chips */}
        {([0, 3, 4, 5] as MinRating[]).map((r) => {
          const isActive = minRating === r;
          return (
            <button
              key={r}
              onClick={() => setMinRating(r)}
              className="shrink-0 flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-full transition-all active:scale-95"
              style={isActive
                ? { backgroundColor: '#FEFCE8', color: '#CA8A04', border: '1.5px solid #FEF08A' }
                : { backgroundColor: 'white', color: '#94A3B8', border: '1.5px solid #E2E8F0' }
              }
            >
              {r === 0 ? (
                <>All ratings</>
              ) : (
                <>
                  <Star size={10} fill={isActive ? '#FACC15' : '#CBD5E1'} style={{ color: isActive ? '#FACC15' : '#CBD5E1' }} />
                  {r}+
                </>
              )}
            </button>
          );
        })}
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
            {!query && typeFilter === 'all' && !openOnly && section === 'all' && minRating === 0
              ? 'Wala pang vendor'
              : 'Walang nahanap'}
          </p>
          <p className="text-xs text-slate-400 mb-4">
            {!query && typeFilter === 'all' && !openOnly && section === 'all' && minRating === 0
              ? 'Maging una sa palengke'
              : 'Subukan ng ibang search, section, o rating filter'}
          </p>
          {(query || typeFilter !== 'all' || openOnly || section !== 'all' || minRating !== 0) && (
            <button
              onClick={() => {
                setQuery('');
                setTypeFilter('all');
                setOpenOnly(false);
                setSection('all');
                setMinRating(0);
              }}
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
            <VendorCard key={v.id} vendor={v} status={statuses.get(v.wallet)} rating={ratings.get(v.wallet)} />
          ))}
        </div>
      )}
    </div>
  );
}
