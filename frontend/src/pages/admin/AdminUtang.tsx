import { useEffect, useMemo, useState, useCallback } from 'react';
import { ShieldCheck, ShieldOff, RefreshCw, AlertTriangle, Loader2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../../lib/hooks/useWallet';
import { useAllVendors } from '../../lib/hooks/useVendor';
import {
  type UtangRecord,
  useMarkDefault,
  isOverdue,
  daysPastDue,
  secondsPastDue,
  useUtangGracePeriod,
  formatGraceSeconds,
} from '../../lib/hooks/useUtang';
import { simulateViewCall, addressToScVal, u32ToScVal, truncateAddress } from '../../lib/stellar';
import { UtangCard } from '../../components/UtangCard';
import { useToast } from '../../lib/hooks/useToast';

const ESCROW_ID = import.meta.env.VITE_UTANG_ESCROW_CONTRACT_ID as string | undefined;
const STROOPS = 10_000_000;

interface RawUtang {
  id: bigint;
  customer: string;
  vendor: string;
  total_amount: bigint;
  installment_amount: bigint;
  installments_total: number;
  installments_paid: number;
  next_due: bigint;
  interval_seconds: bigint;
  // Soroban enum variants without associated data come through scValToNative
  // in stellar-sdk@15 as a 1-element array (e.g. ["Defaulted"]). Older
  // SDKs returned { tag: "..." } or a plain string. Accept any shape so the
  // UI keeps working across SDK versions.
  status: string | string[] | { tag: string };
  description: string;
}

function readStatusTag(s: RawUtang['status']): string {
  if (typeof s === 'string') return s;
  if (Array.isArray(s) && s.length > 0) return String(s[0]);
  if (s && typeof s === 'object' && 'tag' in s) return String(s.tag);
  return 'Active';
}

function mapUtang(raw: RawUtang): UtangRecord {
  const tag = readStatusTag(raw.status);
  return {
    id: raw.id,
    customerWallet: String(raw.customer),
    vendorWallet: String(raw.vendor),
    totalAmountXlm: Number(raw.total_amount) / STROOPS,
    installmentAmountXlm: Number(raw.installment_amount) / STROOPS,
    installmentsTotal: Number(raw.installments_total),
    installmentsPaid: Number(raw.installments_paid),
    nextDueSecs: raw.next_due,
    intervalDays: Math.round(Number(raw.interval_seconds) / 86400),
    status: tag === 'Completed' ? 'completed' : tag === 'Defaulted' ? 'defaulted' : 'active',
    description: String(raw.description ?? ''),
  };
}

function useAllUtangs(vendorWallets: string[]) {
  const [utangs, setUtangs] = useState<UtangRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!ESCROW_ID || vendorWallets.length === 0) {
      setUtangs([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    Promise.all(
      vendorWallets.map((w) =>
        simulateViewCall(ESCROW_ID!, 'get_vendor_utangs', [
          addressToScVal(w),
          u32ToScVal(50),
          u32ToScVal(0),
        ]).catch(() => [] as RawUtang[])
      )
    )
      .then((batches) => {
        const flat = batches.flat() as RawUtang[];
        setUtangs(flat.map(mapUtang));
      })
      .catch((err: unknown) => {
        setError((err as Error).message ?? 'Failed to load utangs');
      })
      .finally(() => setIsLoading(false));
  }, [vendorWallets, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { utangs, isLoading, error, refetch };
}

type Filter = 'overdue' | 'eligible' | 'defaulted' | 'all';

export function AdminUtang() {
  const { address, isConnected, connect } = useWallet();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { vendors, isLoading: loadingVendors } = useAllVendors();
  const vendorWallets = useMemo(() => vendors.map((v) => v.wallet).filter(Boolean), [vendors]);
  const { utangs, isLoading: loadingUtangs, refetch } = useAllUtangs(vendorWallets);
  const { markDefault, isMarking } = useMarkDefault();
  const { gracePeriodSecs } = useUtangGracePeriod();
  const [busyId, setBusyId] = useState<bigint | null>(null);
  const [filter, setFilter] = useState<Filter>('eligible');

  const counts = useMemo(() => {
    let overdue = 0, eligible = 0, defaulted = 0;
    for (const u of utangs) {
      if (u.status === 'defaulted') defaulted += 1;
      else if (u.status === 'active' && isOverdue(u.nextDueSecs)) {
        overdue += 1;
        if (secondsPastDue(u.nextDueSecs) > gracePeriodSecs) eligible += 1;
      }
    }
    return { overdue, eligible, defaulted, total: utangs.length };
  }, [utangs, gracePeriodSecs]);

  const filtered = useMemo(() => {
    const sorted = [...utangs].sort((a, b) => {
      const aOver = a.status === 'active' && isOverdue(a.nextDueSecs) ? daysPastDue(a.nextDueSecs) : -1000;
      const bOver = b.status === 'active' && isOverdue(b.nextDueSecs) ? daysPastDue(b.nextDueSecs) : -1000;
      return bOver - aOver;
    });
    switch (filter) {
      case 'overdue':
        return sorted.filter((u) => u.status === 'active' && isOverdue(u.nextDueSecs));
      case 'eligible':
        return sorted.filter(
          (u) => u.status === 'active'
            && isOverdue(u.nextDueSecs)
            && secondsPastDue(u.nextDueSecs) > gracePeriodSecs
        );
      case 'defaulted':
        return sorted.filter((u) => u.status === 'defaulted');
      default:
        return sorted;
    }
  }, [utangs, filter, gracePeriodSecs]);

  const handleMarkDefault = async (u: UtangRecord) => {
    if (!address) return;
    if (!window.confirm(
      `Mark utang #${u.id} as DEFAULTED?\n\nCustomer: ${truncateAddress(u.customerWallet)}\nVendor: ${truncateAddress(u.vendorWallet)}\nTotal: ${u.totalAmountXlm.toFixed(2)} XLM\nPaid: ${u.installmentsPaid}/${u.installmentsTotal}\n\nThis cannot be undone (customer can still resume by paying late fee).`
    )) return;
    setBusyId(u.id);
    const hash = await markDefault(address, u.id);
    setBusyId(null);
    if (hash) {
      showToast(`Marked default. Tx ${hash.slice(0, 8)}…`, 'success');
      refetch();
    } else {
      showToast('Mark default failed (check grace period elapsed)', 'error');
    }
  };

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <ShieldCheck size={32} className="mx-auto mb-3 text-slate-400" />
        <h1 className="text-xl font-black mb-2">Admin — Utang Default Management</h1>
        <p className="text-sm text-slate-500 mb-6">Connect admin wallet to continue</p>
        <button
          onClick={connect}
          className="font-black px-8 py-3 rounded-2xl active:scale-95 text-white"
          style={{ backgroundColor: '#00284B' }}
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-page-in">
      <div className="relative rounded-3xl overflow-hidden" style={{ backgroundColor: '#00284B' }}>
        <div className="absolute pointer-events-none" style={{ top: -60, right: -40, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(239,68,68,0.3) 0%, transparent 65%)', filter: 'blur(50px)' }} />
        <div className="relative p-5">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => navigate('/admin/market')} className="text-white/60 active:scale-95">
              <ArrowLeft size={20} />
            </button>
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
              <ShieldOff size={20} className="text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-black text-white truncate" style={{ fontFamily: "'Montserrat', sans-serif" }}>Utang Defaults</h1>
              <p className="text-xs font-mono truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{truncateAddress(address ?? '')}</p>
            </div>
            <button
              onClick={refetch}
              className="ml-auto text-white/60 active:scale-95"
              title="Refresh"
            >
              {loadingUtangs ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {([
              ['eligible', counts.eligible, '#F87171', 'Default-ready'],
              ['overdue', counts.overdue, '#FBBF24', 'Overdue'],
              ['defaulted', counts.defaulted, '#94A3B8', 'Defaulted'],
              ['all', counts.total, '#5EEAD4', 'All'],
            ] as Array<[Filter, number, string, string]>).map(([f, n, color, label]) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="rounded-2xl p-3 text-left transition-all active:scale-95"
                style={{
                  backgroundColor: filter === f ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)',
                  border: filter === f ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent',
                }}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</p>
                <p className="text-2xl font-black text-white" style={{ fontFamily: "'Montserrat', sans-serif", color }}>
                  {loadingUtangs || loadingVendors ? '…' : n}
                </p>
              </button>
            ))}
          </div>

          <div className="mt-4 px-3 py-2 rounded-xl flex items-start gap-2" style={{ backgroundColor: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)' }}>
            <AlertTriangle size={12} style={{ color: '#FCD34D' }} className="mt-0.5 shrink-0" />
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.7)' }}>
              Mark Default is only callable after {formatGraceSeconds(gracePeriodSecs)} grace past <code>next_due</code>. Reserve (1% of payments) pays out to vendor; customer can resume by paying 5% late fee.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {loadingUtangs && filtered.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <Loader2 size={24} className="animate-spin mx-auto mb-2" />
            <p className="text-sm">Loading utangs across {vendorWallets.length} vendors…</p>
          </div>
        )}
        {!loadingUtangs && filtered.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <ShieldCheck size={28} className="mx-auto mb-2" />
            <p className="text-sm font-semibold">No utangs match filter</p>
          </div>
        )}
        {filtered.map((u) => (
          <UtangCard
            key={String(u.id)}
            utang={u}
            perspective="admin"
            onMarkDefault={handleMarkDefault}
            busy={isMarking && busyId === u.id}
            graceSeconds={gracePeriodSecs}
          />
        ))}
      </div>
    </div>
  );
}
