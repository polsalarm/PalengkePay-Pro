import { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, XCircle, Loader2, Users, Clock, ExternalLink,
  RefreshCw, ShieldCheck, PowerOff, AlertTriangle, X, Star,
  MapPin, Phone, Hash, Wallet, Tag, CalendarClock } from 'lucide-react';
import { useWallet } from '../../lib/hooks/useWallet';
import { usePendingVendors, useAllVendors, useAdminActions } from '../../lib/hooks/useVendor';
import type { VendorProfile, VendorApplication } from '../../lib/hooks/useVendor';
import { useToast } from '../../lib/hooks/useToast';
import { useBulkVendorRatings } from '../../lib/hooks/useRating';
import type { RatingSummary } from '../../lib/rating';
import { stellarExpertAccountUrl, truncateAddress } from '../../lib/stellar';

const PRODUCT_META: Record<string, { emoji: string; label: string; accent: string; bg: string; chipBg: string; chipColor: string }> = {
  fish:            { emoji: '🐟', label: 'Fish',          accent: '#2563EB', bg: '#EFF6FF', chipBg: '#DBEAFE', chipColor: '#1D4ED8' },
  meat:            { emoji: '🥩', label: 'Meat',          accent: '#DC2626', bg: '#FEF2F2', chipBg: '#FEE2E2', chipColor: '#B91C1C' },
  vegetables:      { emoji: '🥦', label: 'Vegetables',    accent: '#16A34A', bg: '#F0FDF4', chipBg: '#DCFCE7', chipColor: '#15803D' },
  fruits:          { emoji: '🍎', label: 'Fruits',        accent: '#EA580C', bg: '#FFF7ED', chipBg: '#FED7AA', chipColor: '#C2410C' },
  'rice & grains': { emoji: '🌾', label: 'Rice & Grains', accent: '#CA8A04', bg: '#FEFCE8', chipBg: '#FEF08A', chipColor: '#A16207' },
  spices:          { emoji: '🌶️', label: 'Spices',        accent: '#DB2777', bg: '#FDF2F8', chipBg: '#FBCFE8', chipColor: '#BE185D' },
  other:           { emoji: '🛒', label: 'Other',         accent: '#475569', bg: '#F8FAFC', chipBg: '#E2E8F0', chipColor: '#334155' },
};

const AVATAR_COLORS = ['#008055', '#4F46E5', '#D97706', '#F43F5E', '#042E80'];

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
  return (
    <div
      className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-sm shrink-0"
      style={{ backgroundColor: color, fontFamily: "'Montserrat', sans-serif" }}
    >
      {initials || '?'}
    </div>
  );
}

type Tab = 'pending' | 'vendors';

// ── Application card ──────────────────────────────────────────────────────────

function ApplicationCard({
  app, onApprove, onReject, onOpenDetails, loading,
}: {
  app: VendorApplication;
  onApprove: () => void;
  onReject: () => void;
  onOpenDetails: () => void;
  loading: boolean;
}) {
  const meta = PRODUCT_META[app.productType] ?? PRODUCT_META.other;

  // Stop clicks on inner controls from also triggering the card-wide details handler.
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      onClick={onOpenDetails}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenDetails(); } }}
      className="rounded-3xl overflow-hidden cursor-pointer transition-all active:scale-[0.99]"
      style={{ border: `1.5px solid ${meta.accent}28` }}
    >

      {/* Colored header — same pattern as MarketDirectory */}
      <div
        className="px-4 pt-4 pb-3 flex items-center justify-between gap-3"
        style={{ backgroundColor: meta.bg }}
      >
        <span className="text-4xl leading-none select-none">{meta.emoji}</span>
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1"
            style={{ backgroundColor: '#FFFBEB', color: '#D97706' }}
          >
            <Clock size={11} /> Pending
          </span>
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-full capitalize"
            style={{ backgroundColor: meta.chipBg, color: meta.chipColor }}
          >
            {meta.label}
          </span>
        </div>
      </div>

      {/* White body */}
      <div className="bg-white p-4 space-y-4">
        <div className="flex items-start gap-3">
          <Avatar name={app.name} />
          <div className="flex-1 min-w-0">
            <p className="font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>{app.name}</p>
            <p className="text-xs font-bold text-slate-400 mt-0.5">Stall {app.stallNumber}</p>
            {app.phone && <p className="text-xs text-slate-400 mt-0.5">📞 {app.phone}</p>}
            <p className="text-xs font-mono mt-1" style={{ color: '#CBD5E1' }}>{truncateAddress(app.wallet)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={(e) => { stop(e); onApprove(); }}
            disabled={loading}
            className="flex items-center justify-center gap-2 text-white font-black rounded-2xl active:scale-95 transition-all disabled:opacity-40 text-sm"
            style={{
              backgroundColor: '#008055',
              minHeight: '48px',
              fontFamily: "'Montserrat', sans-serif",
              boxShadow: '0 4px 16px rgba(15,118,110,0.3)',
            }}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
            Approve
          </button>
          <button
            onClick={(e) => { stop(e); onReject(); }}
            disabled={loading}
            className="flex items-center justify-center gap-2 font-black rounded-2xl active:scale-95 transition-all disabled:opacity-40 text-sm"
            style={{
              minHeight: '48px',
              backgroundColor: '#FFF1F2',
              border: '1.5px solid #FECDD3',
              color: '#F43F5E',
              fontFamily: "'Montserrat', sans-serif",
            }}
          >
            <XCircle size={16} />
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Vendor card ───────────────────────────────────────────────────────────────

function VendorCard({
  vendor, rating, onDeactivate, onOpenDetails, loading,
}: {
  vendor: VendorProfile;
  rating: RatingSummary | undefined;
  onDeactivate: () => void;
  onOpenDetails: () => void;
  loading: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const meta = PRODUCT_META[vendor.productType] ?? PRODUCT_META.other;

  // Stop a click on inner controls (Deactivate, confirm modal, expert link)
  // from also triggering the card-wide details handler.
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      onClick={onOpenDetails}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenDetails(); } }}
      className="rounded-3xl overflow-hidden transition-all cursor-pointer active:scale-[0.99]"
      style={{
        border: `1.5px solid ${vendor.isActive ? meta.accent + '28' : '#F1F5F9'}`,
        opacity: vendor.isActive ? 1 : 0.55,
      }}
    >
      {/* Colored accent strip */}
      <div
        className="px-4 pt-3 pb-2 flex items-center justify-between gap-2"
        style={{ backgroundColor: meta.bg }}
      >
        <div className="flex items-center gap-2">
          <span className="text-2xl leading-none select-none">{meta.emoji}</span>
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full capitalize"
            style={{ backgroundColor: meta.chipBg, color: meta.chipColor }}
          >
            {meta.label}
          </span>
        </div>
        {vendor.isActive ? (
          <span
            className="text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1"
            style={{ backgroundColor: '#F0FDF4', color: '#16A34A' }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#22C55E' }} />
            Active
          </span>
        ) : (
          <span
            className="text-xs font-bold px-2.5 py-0.5 rounded-full"
            style={{ backgroundColor: '#F8FAFC', color: '#94A3B8' }}
          >
            Inactive
          </span>
        )}
      </div>

      <div className="bg-white p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Avatar name={vendor.name} />
          <div className="flex-1 min-w-0">
            <p className="font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>{vendor.name}</p>
            <p className="text-xs font-bold text-slate-400 mt-0.5">Stall {vendor.stallNumber}</p>
            {vendor.phone && (
              <p className="text-xs text-slate-400 mt-0.5">📞 {vendor.phone}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 px-1 py-2 rounded-2xl" style={{ backgroundColor: '#F8FAFC' }}>
          <div className="flex-1 text-center">
            <p className="text-lg font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              {vendor.totalTransactions}
            </p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">txns</p>
          </div>
          <div className="w-px h-8" style={{ backgroundColor: '#E2E8F0' }} />
          <div className="flex-1 text-center">
            <p className="text-lg font-black" style={{ fontFamily: "'Montserrat', sans-serif", color: '#008055' }}>
              {(Number(vendor.totalVolume) / 10_000_000).toFixed(1)}
            </p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">XLM</p>
          </div>
          <div className="w-px h-8" style={{ backgroundColor: '#E2E8F0' }} />
          <div className="flex-1 text-center">
            {rating && rating.count > 0 ? (
              <>
                <p
                  className="text-lg font-black flex items-center justify-center gap-1"
                  style={{ fontFamily: "'Montserrat', sans-serif", color: '#CA8A04' }}
                >
                  <Star size={13} fill="#FACC15" style={{ color: '#FACC15' }} />
                  {rating.average.toFixed(1)}
                </p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">{rating.count} {rating.count === 1 ? 'rating' : 'ratings'}</p>
              </>
            ) : (
              <>
                <p className="text-lg font-black text-slate-300" style={{ fontFamily: "'Montserrat', sans-serif" }}>—</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">no ratings</p>
              </>
            )}
          </div>
          <a
            onClick={stop}
            href={stellarExpertAccountUrl(vendor.wallet)}
            target="_blank"
            rel="noopener noreferrer"
            className="pr-2 active:scale-95 transition-all"
            style={{ color: '#CBD5E1' }}
          >
            <ExternalLink size={14} />
          </a>
        </div>

        {vendor.isActive && !confirming && (
          <button
            onClick={(e) => { stop(e); setConfirming(true); }}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 font-bold rounded-2xl active:scale-95 transition-all text-sm disabled:opacity-40"
            style={{
              minHeight: '44px',
              border: '1.5px solid #F1F5F9',
              color: '#94A3B8',
              backgroundColor: 'transparent',
            }}
          >
            <PowerOff size={14} />
            Deactivate Vendor
          </button>
        )}

        {confirming && (
          <div onClick={stop} className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: '#FFF1F2', border: '1.5px solid #FECDD3' }}>
            <div className="flex items-center gap-2" style={{ color: '#F43F5E' }}>
              <AlertTriangle size={15} />
              <p className="text-sm font-black" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                Deactivate {vendor.name}?
              </p>
            </div>
            <p className="text-xs" style={{ color: '#F43F5E', opacity: 0.75 }}>
              Marks vendor as inactive on-chain. They will no longer appear active in the market.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={(e) => { stop(e); setConfirming(false); onDeactivate(); }}
                disabled={loading}
                className="flex items-center justify-center gap-1.5 text-white font-black rounded-2xl active:scale-95 transition-all text-sm disabled:opacity-40"
                style={{ backgroundColor: '#F43F5E', minHeight: '44px', fontFamily: "'Montserrat', sans-serif" }}
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <PowerOff size={14} />}
                Deactivate
              </button>
              <button
                onClick={(e) => { stop(e); setConfirming(false); }}
                className="flex items-center justify-center gap-1.5 font-bold rounded-2xl active:scale-95 transition-all text-sm"
                style={{ minHeight: '44px', border: '1.5px solid #FECDD3', color: '#F43F5E', backgroundColor: 'transparent' }}
              >
                <X size={14} />
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Vendor detail drawer ──────────────────────────────────────────────────────

function VendorDetailDrawer({
  vendor, rating, onClose,
}: {
  vendor: VendorProfile;
  rating: RatingSummary | undefined;
  onClose: () => void;
}) {
  const meta = PRODUCT_META[vendor.productType] ?? PRODUCT_META.other;
  const xlm = (Number(vendor.totalVolume) / 10_000_000).toFixed(2);

  // Lock body scroll while drawer open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Render via portal so we escape any ancestor with `transform` (which
  // would otherwise become the containing block for our `position: fixed`).
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
      style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-3xl overflow-hidden animate-slide-up shadow-2xl"
      >
        {/* Header strip */}
        <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3" style={{ backgroundColor: meta.bg }}>
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-4xl leading-none select-none">{meta.emoji}</span>
            <div className="min-w-0">
              <p className="text-lg font-black text-slate-900 truncate" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                {vendor.name}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize"
                  style={{ backgroundColor: meta.chipBg, color: meta.chipColor }}
                >
                  {meta.label}
                </span>
                {vendor.isActive ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ backgroundColor: '#F0FDF4', color: '#16A34A' }}>
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#22C55E' }} />
                    Active
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#F8FAFC', color: '#94A3B8' }}>
                    Inactive
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-2xl flex items-center justify-center active:scale-95 shrink-0"
            style={{ backgroundColor: 'rgba(255,255,255,0.7)' }}
          >
            <X size={16} style={{ color: '#475569' }} />
          </button>
        </div>

        {/* Stats triplet */}
        <div className="px-5 pt-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl p-3 text-center" style={{ backgroundColor: '#F8FAFC' }}>
              <p className="text-xl font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                {vendor.totalTransactions}
              </p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">transactions</p>
            </div>
            <div className="rounded-2xl p-3 text-center" style={{ backgroundColor: '#F8FAFC' }}>
              <p className="text-xl font-black" style={{ fontFamily: "'Montserrat', sans-serif", color: '#008055' }}>
                {xlm}
              </p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">XLM volume</p>
            </div>
            <div className="rounded-2xl p-3 text-center" style={{ backgroundColor: '#FFFBEB' }}>
              {rating && rating.count > 0 ? (
                <>
                  <p className="text-xl font-black flex items-center justify-center gap-1" style={{ fontFamily: "'Montserrat', sans-serif", color: '#CA8A04' }}>
                    <Star size={14} fill="#FACC15" style={{ color: '#FACC15' }} />
                    {rating.average.toFixed(1)}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: '#A16207' }}>
                    {rating.count} {rating.count === 1 ? 'rating' : 'ratings'}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xl font-black text-slate-300" style={{ fontFamily: "'Montserrat', sans-serif" }}>—</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">no ratings</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Detail rows */}
        <div className="px-5 py-4 space-y-3">
          <DetailRow icon={<Hash size={14} />} label="Vendor ID" value={`#${vendor.id}`} />
          <DetailRow icon={<MapPin size={14} />} label="Stall" value={vendor.stallNumber} />
          <DetailRow icon={<Tag size={14} />} label="Product type" value={meta.label} />
          <DetailRow icon={<MapPin size={14} />} label="Market" value={vendor.marketId} />
          {vendor.phone && <DetailRow icon={<Phone size={14} />} label="Phone" value={vendor.phone} />}
          <DetailRow
            icon={<Wallet size={14} />}
            label="Wallet"
            value={
              <a
                href={stellarExpertAccountUrl(vendor.wallet)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs underline decoration-dotted"
                style={{ color: '#2563EB' }}
              >
                {truncateAddress(vendor.wallet)}
                <ExternalLink size={10} className="inline ml-1" />
              </a>
            }
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Pending application detail drawer ────────────────────────────────────────

function PendingDetailDrawer({
  app, onClose, onApprove, onReject, loading,
}: {
  app: VendorApplication;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  loading: boolean;
}) {
  const meta = PRODUCT_META[app.productType] ?? PRODUCT_META.other;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // appliedAt is a unix-seconds bigint from the contract ledger.
  const appliedDate = (() => {
    const secs = Number(app.appliedAt);
    if (!Number.isFinite(secs) || secs <= 0) return null;
    try { return new Date(secs * 1000); } catch { return null; }
  })();

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
      style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-3xl overflow-hidden animate-slide-up shadow-2xl"
      >
        {/* Header strip */}
        <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3" style={{ backgroundColor: meta.bg }}>
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-4xl leading-none select-none">{meta.emoji}</span>
            <div className="min-w-0">
              <p className="text-lg font-black text-slate-900 truncate" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                {app.name}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize"
                  style={{ backgroundColor: meta.chipBg, color: meta.chipColor }}
                >
                  {meta.label}
                </span>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                  style={{ backgroundColor: '#FFFBEB', color: '#D97706' }}
                >
                  <Clock size={10} /> Pending review
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-2xl flex items-center justify-center active:scale-95 shrink-0"
            style={{ backgroundColor: 'rgba(255,255,255,0.7)' }}
          >
            <X size={16} style={{ color: '#475569' }} />
          </button>
        </div>

        {/* Status banner */}
        <div className="px-5 pt-4">
          <div
            className="rounded-2xl p-4 flex items-start gap-3"
            style={{ backgroundColor: '#FFFBEB', border: '1.5px solid #FDE68A' }}
          >
            <AlertTriangle size={16} style={{ color: '#D97706' }} className="shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-black" style={{ color: '#92400E', fontFamily: "'Montserrat', sans-serif" }}>
                Awaiting admin approval
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#B45309' }}>
                This vendor cannot receive payments until you approve their application on-chain.
              </p>
            </div>
          </div>
        </div>

        {/* Detail rows */}
        <div className="px-5 py-4 space-y-3">
          <DetailRow icon={<MapPin size={14} />} label="Stall" value={app.stallNumber} />
          <DetailRow icon={<Tag size={14} />} label="Product type" value={meta.label} />
          <DetailRow icon={<MapPin size={14} />} label="Market" value={app.marketId} />
          {app.phone && <DetailRow icon={<Phone size={14} />} label="Phone" value={app.phone} />}
          {appliedDate && (
            <DetailRow
              icon={<CalendarClock size={14} />}
              label="Applied"
              value={appliedDate.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
            />
          )}
          <DetailRow
            icon={<Wallet size={14} />}
            label="Wallet"
            value={
              <a
                href={stellarExpertAccountUrl(app.wallet)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs underline decoration-dotted"
                style={{ color: '#2563EB' }}
              >
                {truncateAddress(app.wallet)}
                <ExternalLink size={10} className="inline ml-1" />
              </a>
            }
          />
        </div>

        {/* Action buttons */}
        <div className="px-5 pb-5">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onApprove}
              disabled={loading}
              className="flex items-center justify-center gap-2 text-white font-black rounded-2xl active:scale-95 transition-all disabled:opacity-40 text-sm"
              style={{
                backgroundColor: '#008055',
                minHeight: '48px',
                fontFamily: "'Montserrat', sans-serif",
                boxShadow: '0 4px 16px rgba(15,118,110,0.3)',
              }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              Approve
            </button>
            <button
              onClick={onReject}
              disabled={loading}
              className="flex items-center justify-center gap-2 font-black rounded-2xl active:scale-95 transition-all disabled:opacity-40 text-sm"
              style={{
                minHeight: '48px',
                backgroundColor: '#FFF1F2',
                border: '1.5px solid #FECDD3',
                color: '#F43F5E',
                fontFamily: "'Montserrat', sans-serif",
              }}
            >
              <XCircle size={16} />
              Decline
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b last:border-b-0" style={{ borderColor: '#F1F5F9' }}>
      <div className="flex items-center gap-2 text-slate-400">
        {icon}
        <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-sm font-bold text-slate-900 text-right min-w-0 truncate">{value}</div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AdminMarket() {
  const { address, isConnected, connect } = useWallet();
  const [tab, setTab] = useState<Tab>('pending');
  const { applications, isLoading: loadingPending, error: pendingError, refetch: refetchPending } = usePendingVendors();
  const { vendors, isLoading: loadingVendors, error: vendorsError, refetch: refetchVendors } = useAllVendors();
  const { approve, reject, deactivate, loadingWallet, error: actionError } = useAdminActions();
  const { showToast } = useToast();
  const [selected, setSelected] = useState<VendorProfile | null>(null);
  const [selectedApp, setSelectedApp] = useState<VendorApplication | null>(null);

  const activeVendors = vendors.filter((v) => v.isActive);
  const vendorAddresses = useMemo(() => vendors.map((v) => v.wallet).filter(Boolean), [vendors]);
  const { summaries: ratings } = useBulkVendorRatings(vendorAddresses);

  const handleApprove = async (vendorWallet: string, name: string) => {
    if (!address) return;
    const ok = await approve(address, vendorWallet);
    if (ok) {
      showToast(`${name} approved!`, 'success');
      refetchPending();
      refetchVendors();
      setSelectedApp(null);
    } else showToast(actionError?.slice(0, 100) ?? 'Approve failed', 'error');
  };

  const handleReject = async (vendorWallet: string, name: string) => {
    if (!address) return;
    const ok = await reject(address, vendorWallet);
    if (ok) {
      showToast(`${name} declined.`, 'success');
      refetchPending();
      setSelectedApp(null);
    } else showToast(actionError?.slice(0, 100) ?? 'Reject failed', 'error');
  };

  const handleDeactivate = async (vendorWallet: string, name: string) => {
    if (!address) return;
    const ok = await deactivate(address, vendorWallet);
    if (ok) { showToast(`${name} deactivated.`, 'success'); refetchVendors(); }
    else showToast(actionError?.slice(0, 100) ?? 'Deactivate failed', 'error');
  };

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto animate-page-in">
        <div className="relative rounded-3xl overflow-hidden" style={{ backgroundColor: '#00284B' }}>
          <div className="absolute pointer-events-none" style={{ top: -60, right: -40, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(20,184,166,0.3) 0%, transparent 65%)', filter: 'blur(50px)' }} />
          <div className="relative p-10 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
              <ShieldCheck size={28} className="text-white" />
            </div>
            <h1 className="text-xl font-black text-white mb-2" style={{ fontFamily: "'Montserrat', sans-serif" }}>Admin Dashboard</h1>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>Connect admin wallet to manage vendors</p>
            <button
              onClick={connect}
              className="font-black px-8 py-3 rounded-2xl active:scale-95 text-white"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', fontFamily: "'Montserrat', sans-serif" }}
            >
              Connect Wallet
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-page-in">

      {/* Hero */}
      <div className="relative rounded-3xl overflow-hidden" style={{ backgroundColor: '#00284B' }}>
        <div className="absolute inset-0 pointer-events-none opacity-[0.04]" style={{ backgroundImage: `repeating-linear-gradient(45deg, white 0px, white 1px, transparent 1px, transparent 12px), repeating-linear-gradient(-45deg, white 0px, white 1px, transparent 1px, transparent 12px)` }} />
        <div className="absolute pointer-events-none" style={{ top: -60, right: -40, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(20,184,166,0.3) 0%, transparent 65%)', filter: 'blur(50px)' }} />

        <div className="relative p-5">
          {/* Row 1: title */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
              <ShieldCheck size={20} className="text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-black text-white truncate" style={{ fontFamily: "'Montserrat', sans-serif" }}>Admin Dashboard</h1>
              <p className="text-xs font-mono truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{truncateAddress(address ?? '')}</p>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setTab('pending')}
              className="rounded-2xl p-4 text-left transition-all active:scale-95"
              style={{
                backgroundColor: tab === 'pending' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)',
                border: tab === 'pending' ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Clock size={14} style={{ color: '#FCD34D' }} />
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.5)' }}>Pending</span>
              </div>
              <p className="text-3xl font-black text-white" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                {loadingPending ? '…' : applications.length}
              </p>
              {applications.length > 0
                ? <p className="text-xs mt-1" style={{ color: '#FCD34D' }}>Needs review</p>
                : <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>All clear</p>
              }
            </button>
            <button
              onClick={() => setTab('vendors')}
              className="rounded-2xl p-4 text-left transition-all active:scale-95"
              style={{
                backgroundColor: tab === 'vendors' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)',
                border: tab === 'vendors' ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Users size={14} style={{ color: '#5EEAD4' }} />
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.5)' }}>Vendors</span>
              </div>
              <p className="text-3xl font-black text-white" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                {loadingVendors ? '…' : activeVendors.length}
              </p>
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>active in market</p>
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {(pendingError || vendorsError) && (
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ backgroundColor: '#FFF1F2', border: '1.5px solid #FECDD3' }}>
          <AlertTriangle size={16} style={{ color: '#F43F5E' }} />
          <div>
            {pendingError && <p className="text-sm font-semibold" style={{ color: '#F43F5E' }}>Pending: {pendingError}</p>}
            {vendorsError && <p className="text-sm font-semibold" style={{ color: '#F43F5E' }}>Vendors: {vendorsError}</p>}
          </div>
        </div>
      )}

      {/* ── Tab: Pending ── */}
      {tab === 'pending' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-slate-800" style={{ fontFamily: "'Montserrat', sans-serif" }}>Pending Applications</h2>
              {applications.length > 0 && (
                <span
                  className="text-xs font-black px-2.5 py-0.5 rounded-full"
                  style={{ backgroundColor: '#FFFBEB', color: '#D97706' }}
                >
                  {applications.length} new
                </span>
              )}
            </div>
            <button
              onClick={refetchPending}
              className="w-8 h-8 rounded-xl flex items-center justify-center active:scale-95 transition-all"
              style={{ backgroundColor: '#F8FAFC' }}
            >
              <RefreshCw size={13} style={{ color: '#94A3B8' }} />
            </button>
          </div>

          {loadingPending && (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={28} className="animate-spin" style={{ color: '#008055' }} />
            </div>
          )}

          {!loadingPending && applications.length === 0 && (
            <div className="rounded-3xl p-10 text-center" style={{ border: '1.5px solid #F1F5F9' }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#F8FAFC' }}>
                <Clock size={24} style={{ color: '#CBD5E1' }} />
              </div>
              <p className="text-sm font-bold text-slate-500">No pending applications</p>
              <p className="text-xs text-slate-400 mt-1">New vendor applications will appear here for review</p>
            </div>
          )}

          {!loadingPending && applications.map((app) => (
            <ApplicationCard
              key={app.wallet}
              app={app}
              loading={loadingWallet === app.wallet}
              onApprove={() => handleApprove(app.wallet, app.name)}
              onReject={() => handleReject(app.wallet, app.name)}
              onOpenDetails={() => setSelectedApp(app)}
            />
          ))}
        </div>
      )}

      {/* ── Tab: Vendors ── */}
      {tab === 'vendors' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-black text-slate-800" style={{ fontFamily: "'Montserrat', sans-serif" }}>Registered Vendors</h2>
            <button
              onClick={refetchVendors}
              className="w-8 h-8 rounded-xl flex items-center justify-center active:scale-95 transition-all"
              style={{ backgroundColor: '#F8FAFC' }}
            >
              <RefreshCw size={13} style={{ color: '#94A3B8' }} />
            </button>
          </div>

          {loadingVendors && (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={28} className="animate-spin" style={{ color: '#008055' }} />
            </div>
          )}

          {!loadingVendors && vendors.length === 0 && (
            <div className="rounded-3xl p-10 text-center" style={{ border: '1.5px solid #F1F5F9' }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#F8FAFC' }}>
                <Users size={24} style={{ color: '#CBD5E1' }} />
              </div>
              <p className="text-sm font-bold text-slate-500">No vendors registered yet</p>
              <p className="text-xs text-slate-400 mt-1">Approve applications to add vendors to the market</p>
            </div>
          )}

          {!loadingVendors && vendors.map((v) => (
            <VendorCard
              key={v.id}
              vendor={v}
              rating={ratings.get(v.wallet)}
              loading={loadingWallet === v.wallet}
              onDeactivate={() => handleDeactivate(v.wallet, v.name)}
              onOpenDetails={() => setSelected(v)}
            />
          ))}
        </div>
      )}

      {selected && (
        <VendorDetailDrawer
          vendor={selected}
          rating={ratings.get(selected.wallet)}
          onClose={() => setSelected(null)}
        />
      )}

      {selectedApp && (
        <PendingDetailDrawer
          app={selectedApp}
          loading={loadingWallet === selectedApp.wallet}
          onClose={() => setSelectedApp(null)}
          onApprove={() => handleApprove(selectedApp.wallet, selectedApp.name)}
          onReject={() => handleReject(selectedApp.wallet, selectedApp.name)}
        />
      )}
    </div>
  );
}
