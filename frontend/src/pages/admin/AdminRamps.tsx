import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, RefreshCw, Send, X, KeyRound, ExternalLink, Download, DatabaseZap, MessageSquare, AlertTriangle } from 'lucide-react';
import { useToast } from '../../lib/hooks/useToast';
import { exportRamps, listAllRamps, seedDemoRamps, type RampTxn } from '../../lib/ramp';
import { truncateAddress, stellarExpertUrl } from '../../lib/stellar';

const KEY_STORAGE = 'pp_ramp_admin_key';

type DialogRequest =
  | {
      kind: 'prompt';
      title: string;
      body?: string;
      placeholder?: string;
      defaultValue?: string;
      confirmLabel?: string;
      tone?: 'success' | 'danger';
      icon?: React.ReactNode;
      onSubmit: (value: string) => void;
    }
  | {
      kind: 'confirm';
      title: string;
      body?: string;
      confirmLabel?: string;
      tone?: 'success' | 'danger';
      icon?: React.ReactNode;
      onSubmit: () => void;
    };

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
  const [allCount, setAllCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [utilityBusy, setUtilityBusy] = useState(false);
  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  const [dialogInput, setDialogInput] = useState('');
  const dialogInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (dialog?.kind === 'prompt') {
      setDialogInput(dialog.defaultValue ?? '');
      setTimeout(() => dialogInputRef.current?.focus(), 50);
    }
  }, [dialog]);

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
      listAllRamps(adminKey)
        .then((all) => setAllCount(all.length))
        .catch(() => setAllCount(0));
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

  const downloadAudit = async (format: 'csv' | 'json') => {
    setUtilityBusy(true);
    try {
      const blob = await exportRamps(adminKey, format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `palengkepay-ramp-audit.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast(`${format.toUpperCase()} audit export ready`, 'success');
    } catch (err: unknown) {
      showToast((err as Error).message, 'error');
    } finally {
      setUtilityBusy(false);
    }
  };

  const runSeedDemo = async () => {
    setUtilityBusy(true);
    try {
      const created = await seedDemoRamps(adminKey);
      showToast(`Seeded ${created.length} demo records`, 'success');
      await refresh();
    } catch (err: unknown) {
      showToast((err as Error).message, 'error');
    } finally {
      setUtilityBusy(false);
    }
  };

  const seedDemo = () => {
    setDialog({
      kind: 'confirm',
      title: 'Seed demo ramp records?',
      body: 'Adds four sample transactions for review. Existing records stay untouched.',
      confirmLabel: 'Seed records',
      tone: 'success',
      icon: <DatabaseZap size={18} style={{ color: '#008055' }} />,
      onSubmit: () => { void runSeedDemo(); },
    });
  };

  const openMarkPaid = (id: string) => {
    setDialog({
      kind: 'prompt',
      title: 'Mark PHP sent',
      body: 'Add an operator note or provider reference for audit trail.',
      placeholder: 'e.g. GCash ref 7G2H… / InstaPay batch 8821',
      confirmLabel: 'Mark sent',
      tone: 'success',
      icon: <Send size={18} style={{ color: '#008055' }} />,
      onSubmit: (value) => { void act(id, 'mark_php_sent', value || undefined); },
    });
  };

  const openFail = (id: string) => {
    setDialog({
      kind: 'prompt',
      title: 'Fail this transaction',
      body: 'Customer will be push-notified with this reason.',
      placeholder: 'e.g. Beneficiary account closed',
      defaultValue: 'operator declined',
      confirmLabel: 'Mark failed',
      tone: 'danger',
      icon: <AlertTriangle size={18} style={{ color: '#B91C1C' }} />,
      onSubmit: (value) => { void act(id, 'fail', value || 'operator declined'); },
    });
  };

  const openChangeKey = () => {
    setDialog({
      kind: 'confirm',
      title: 'Clear cached operator key?',
      body: 'You will need to re-enter the RAMP_ADMIN_KEY for this device.',
      confirmLabel: 'Clear key',
      tone: 'danger',
      icon: <KeyRound size={18} style={{ color: '#B91C1C' }} />,
      onSubmit: () => {
        localStorage.removeItem(KEY_STORAGE);
        setAdminKey('');
        setKeyDraft('');
        setTxns([]);
        setAllCount(0);
      },
    });
  };

  const submitDialog = () => {
    if (!dialog) return;
    if (dialog.kind === 'prompt') dialog.onSubmit(dialogInput.trim());
    else dialog.onSubmit();
    setDialog(null);
    setDialogInput('');
  };

  const closeDialog = () => {
    setDialog(null);
    setDialogInput('');
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
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-xl font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>Ramp Admin</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={openChangeKey}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl"
            style={{ backgroundColor: '#FFF1F2', color: '#BE123C' }}
            aria-label="Change admin key"
            title="Change admin key"
          >
            <KeyRound size={12} /> Change key
          </button>
          <button onClick={refresh} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl" style={{ backgroundColor: '#F0FDFA', color: '#008055' }}>
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-white border p-4 space-y-3" style={{ borderColor: '#F1F5F9' }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Operator audit tools</p>
            <p className="text-[11px] text-slate-400 mt-1">{allCount} active-network records available for export</p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full" style={{ backgroundColor: '#F0FDFA', color: '#008055' }}>
            Seed only
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2" style={{ opacity: utilityBusy ? 0.6 : 1, pointerEvents: utilityBusy ? 'none' : 'auto' }}>
          <button onClick={() => downloadAudit('csv')} className="min-h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-1" style={{ backgroundColor: '#F8FAFC', color: '#334155' }}>
            <Download size={13} /> CSV
          </button>
          <button onClick={() => downloadAudit('json')} className="min-h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-1" style={{ backgroundColor: '#F8FAFC', color: '#334155' }}>
            <Download size={13} /> JSON
          </button>
          <button onClick={seedDemo} className="min-h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-1 text-white" style={{ backgroundColor: '#008055' }}>
            <DatabaseZap size={13} /> Seed demo data
          </button>
        </div>
      </div>

      <Section title="Cashouts awaiting PHP payout" icon={<ArrowDownToLine size={16} style={{ color: '#008055' }} />}>
        {cashouts.length === 0 && <p className="text-xs text-slate-400 px-4 py-3">No pending cashouts.</p>}
        {cashouts.map((t) => (
          <RampCard key={t.id} txn={t} busy={busyId === t.id}>
            <button
              onClick={() => openMarkPaid(t.id)}
              className="px-3 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1"
              style={{ backgroundColor: '#008055' }}
            >
              <Send size={12} /> Mark PHP sent
            </button>
            <button
              onClick={() => openFail(t.id)}
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
              onClick={() => openFail(t.id)}
              className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1"
              style={{ backgroundColor: '#FEE2E2', color: '#B91C1C' }}
            >
              <X size={12} /> Fail
            </button>
          </RampCard>
        ))}
      </Section>

      {/* ── Dialog modal ── */}
      {dialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
          onClick={closeDialog}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full rounded-3xl overflow-hidden bg-white"
            style={{ maxWidth: '420px', boxShadow: '0 24px 64px rgba(0,0,0,0.35)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-3 flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: dialog.tone === 'danger' ? '#FEF2F2' : '#F0FDFA', border: `1.5px solid ${dialog.tone === 'danger' ? '#FECACA' : '#A7F3D0'}` }}
              >
                {dialog.icon ?? <MessageSquare size={18} style={{ color: dialog.tone === 'danger' ? '#B91C1C' : '#008055' }} />}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-black text-slate-900 leading-tight" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                  {dialog.title}
                </h3>
                {dialog.body && <p className="text-sm text-slate-500 mt-1">{dialog.body}</p>}
              </div>
              <button
                onClick={closeDialog}
                className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 shrink-0"
                style={{ backgroundColor: '#F1F5F9', color: '#475569' }}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {dialog.kind === 'prompt' && (
              <div className="px-5 pb-2">
                <input
                  ref={dialogInputRef}
                  value={dialogInput}
                  onChange={(e) => setDialogInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); submitDialog(); }
                    if (e.key === 'Escape') closeDialog();
                  }}
                  placeholder={dialog.placeholder}
                  className="w-full px-4 py-3 rounded-2xl text-sm border outline-none focus:ring-2"
                  style={{ borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }}
                />
              </div>
            )}

            <div className="px-5 py-4 flex items-center justify-end gap-2 bg-slate-50" style={{ borderTop: '1px solid #F1F5F9' }}>
              <button
                onClick={closeDialog}
                className="px-4 py-2.5 rounded-xl text-sm font-bold active:scale-95"
                style={{ backgroundColor: 'white', color: '#475569', border: '1px solid #E2E8F0' }}
              >
                Cancel
              </button>
              <button
                onClick={submitDialog}
                className="px-4 py-2.5 rounded-xl text-sm font-black text-white active:scale-95"
                style={{ backgroundColor: dialog.tone === 'danger' ? '#DC2626' : '#008055', fontFamily: "'Montserrat', sans-serif" }}
              >
                {dialog.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
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
          <p className="text-[11px] text-slate-400 mt-1">
            {(txn.network ?? 'testnet').toUpperCase()} · {txn.railProvider ?? 'PDAX_STYLE'} · {txn.railMode ?? 'mock'}
            {txn.feePhp && ` · fee PHP ${txn.feePhp}`}
            {txn.spreadBps !== undefined && ` · spread ${txn.spreadBps} bps`}
          </p>
          {txn.proofReference && <p className="text-[11px] font-mono text-slate-400 mt-1">Proof: {txn.proofReference}</p>}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full shrink-0" style={{ backgroundColor: '#F0FDFA', color: '#008055' }}>
          {txn.status}
        </span>
      </div>
      <div className="flex gap-2" style={{ opacity: busy ? 0.5 : 1, pointerEvents: busy ? 'none' : 'auto' }}>
        {children}
      </div>
      {txn.settlementEvents && txn.settlementEvents.length > 0 && (
        <div className="mt-2 rounded-xl px-3 py-2" style={{ backgroundColor: '#F8FAFC' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Audit timeline</p>
          <div className="mt-1 space-y-1">
            {txn.settlementEvents.slice(-4).map((event) => (
              <p key={`${event.at}-${event.status}`} className="text-[11px] text-slate-500">
                <span className="font-bold text-slate-700">{event.label}</span>
                {event.message ? ` · ${event.message}` : ''}
                {event.externalTxId ? ` · ${event.externalTxId}` : ''}
                {event.operatorNote ? ` · ${event.operatorNote}` : ''}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
