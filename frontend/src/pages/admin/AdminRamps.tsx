import { useCallback, useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, RefreshCw, Send, X, KeyRound, ExternalLink } from 'lucide-react';
import { useToast } from '../../lib/hooks/useToast';
import type { RampTxn } from '../../lib/ramp';
import { truncateAddress, stellarExpertUrl } from '../../lib/stellar';

const KEY_STORAGE = 'pp_ramp_admin_key';

async function adminFetch(adminKey: string, init: RequestInit & { path?: string } = {}): Promise<Response> {
  return fetch(init.path ?? '/api/ramp/admin', {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': adminKey,
      ...(init.headers ?? {}),
    },
  });
}

export function AdminRamps() {
  const { showToast } = useToast();
  const [adminKey, setAdminKey] = useState<string>(() => localStorage.getItem(KEY_STORAGE) ?? '');
  const [keyDraft, setKeyDraft] = useState('');
  const [txns, setTxns] = useState<RampTxn[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!adminKey) return;
    setLoading(true);
    try {
      const res = await adminFetch(adminKey, { method: 'GET' });
      if (res.status === 401) {
        showToast('Invalid admin key', 'error');
        setAdminKey('');
        localStorage.removeItem(KEY_STORAGE);
        return;
      }
      const data = (await res.json()) as { transactions?: RampTxn[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? `status ${res.status}`);
      setTxns(data.transactions ?? []);
    } catch (err: unknown) {
      showToast((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [adminKey, showToast]);

  useEffect(() => {
    refresh();
    if (!adminKey) return;
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [refresh, adminKey]);

  const saveKey = () => {
    if (!keyDraft.trim()) return;
    localStorage.setItem(KEY_STORAGE, keyDraft.trim());
    setAdminKey(keyDraft.trim());
  };

  const act = async (id: string, action: 'mark_php_sent' | 'release_xlm' | 'fail', reason?: string) => {
    setBusyId(id);
    try {
      const res = await adminFetch(adminKey, {
        method: 'POST',
        path: `/api/ramp/admin?action=${action}`,
        body: JSON.stringify({ id, reason }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; stellarTxHash?: string };
      if (!res.ok) throw new Error(data.error ?? `status ${res.status}`);
      showToast(action === 'release_xlm' && data.stellarTxHash ? `Released. Tx ${data.stellarTxHash.slice(0, 8)}…` : 'Done', 'success');
      await refresh();
    } catch (err: unknown) {
      showToast((err as Error).message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  if (!adminKey) {
    return (
      <div className="max-w-md mx-auto space-y-4 animate-page-in">
        <div className="flex items-center gap-3">
          <KeyRound size={20} style={{ color: '#008055' }} />
          <h1 className="text-xl font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>Ramp Admin</h1>
        </div>
        <p className="text-sm text-slate-500">Enter the operator key to manage ramp settlements.</p>
        <input
          type="password"
          value={keyDraft}
          onChange={(e) => setKeyDraft(e.target.value)}
          placeholder="RAMP_ADMIN_KEY"
          className="w-full px-3 py-2 rounded-xl border text-sm"
          style={{ borderColor: '#E2E8F0' }}
        />
        <button
          onClick={saveKey}
          className="w-full py-3 rounded-2xl font-black text-white"
          style={{ backgroundColor: '#008055', fontFamily: "'Montserrat', sans-serif" }}
        >
          Unlock
        </button>
      </div>
    );
  }

  const cashouts = txns.filter((t) => t.kind === 'withdraw');
  const cashins = txns.filter((t) => t.kind === 'deposit');

  return (
    <div className="max-w-2xl space-y-4 animate-page-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>Ramp Admin</h1>
        <button onClick={refresh} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl" style={{ backgroundColor: '#F0FDFA', color: '#008055' }}>
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <Section title="Cashouts awaiting PHP payout" icon={<ArrowDownToLine size={16} style={{ color: '#008055' }} />}>
        {cashouts.length === 0 && <p className="text-xs text-slate-400 px-4 py-3">No pending cashouts.</p>}
        {cashouts.map((t) => (
          <RampCard key={t.id} txn={t} busy={busyId === t.id}>
            <button
              onClick={() => act(t.id, 'mark_php_sent')}
              className="px-3 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1"
              style={{ backgroundColor: '#008055' }}
            >
              <Send size={12} /> Mark PHP sent
            </button>
            <button
              onClick={() => act(t.id, 'fail', prompt('Reason?') ?? 'operator declined')}
              className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1"
              style={{ backgroundColor: '#FEE2E2', color: '#B91C1C' }}
            >
              <X size={12} /> Fail
            </button>
          </RampCard>
        ))}
      </Section>

      <Section title="Cashins awaiting XLM release" icon={<ArrowUpFromLine size={16} style={{ color: '#008055' }} />}>
        {cashins.length === 0 && <p className="text-xs text-slate-400 px-4 py-3">No pending cashins.</p>}
        {cashins.map((t) => (
          <RampCard key={t.id} txn={t} busy={busyId === t.id}>
            <button
              onClick={() => act(t.id, 'release_xlm')}
              className="px-3 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1"
              style={{ backgroundColor: '#008055' }}
            >
              <Send size={12} /> Release XLM
            </button>
            <button
              onClick={() => act(t.id, 'fail', prompt('Reason?') ?? 'operator declined')}
              className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1"
              style={{ backgroundColor: '#FEE2E2', color: '#B91C1C' }}
            >
              <X size={12} /> Fail
            </button>
          </RampCard>
        ))}
      </Section>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white border overflow-hidden" style={{ borderColor: '#F1F5F9' }}>
      <div className="px-4 py-3 flex items-center gap-2" style={{ backgroundColor: '#F8FAFC' }}>
        {icon}
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-600">{title}</h2>
      </div>
      <div className="divide-y" style={{ borderColor: '#F1F5F9' }}>{children}</div>
    </div>
  );
}

function RampCard({ txn, busy, children }: { txn: RampTxn; busy: boolean; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] text-slate-400">{txn.id}</p>
          <p className="text-sm font-bold text-slate-900 mt-0.5">
            {txn.kind === 'withdraw' ? `${txn.amountIn} XLM → PHP ${txn.amountOut ?? '?'}` : `PHP ${txn.amountIn} → ${txn.amountOut ?? '?'} XLM`}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            <span className="font-mono">{truncateAddress(txn.wallet)}</span>
            {txn.rail && ` · ${txn.rail}`}
            {txn.destination && ` · ${txn.destination}`}
          </p>
          {txn.stellarTxHash && (
            <a href={stellarExpertUrl(txn.wallet)} target="_blank" rel="noopener noreferrer" className="text-[11px] inline-flex items-center gap-1 mt-1" style={{ color: '#008055' }}>
              <ExternalLink size={10} /> Stellar tx {txn.stellarTxHash.slice(0, 10)}…
            </a>
          )}
          {txn.message && <p className="text-[11px] text-slate-400 mt-1">{txn.message}</p>}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full shrink-0" style={{ backgroundColor: '#F0FDFA', color: '#008055' }}>
          {txn.status}
        </span>
      </div>
      <div className="flex gap-2" style={{ opacity: busy ? 0.5 : 1, pointerEvents: busy ? 'none' : 'auto' }}>
        {children}
      </div>
    </div>
  );
}
