import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, ServerCog } from 'lucide-react';

interface HealthCheck {
  name: string;
  ok: boolean;
  status: number;
  detail?: string;
}

interface HealthResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  checks: HealthCheck[];
}

const clientEnv = [
  { key: 'VITE_STELLAR_NETWORK', value: import.meta.env.VITE_STELLAR_NETWORK },
  { key: 'VITE_SOROBAN_RPC_URL', value: import.meta.env.VITE_SOROBAN_RPC_URL },
  { key: 'VITE_VENDOR_REGISTRY_CONTRACT_ID', value: import.meta.env.VITE_VENDOR_REGISTRY_CONTRACT_ID },
  { key: 'VITE_PALENGKE_PAYMENT_CONTRACT_ID', value: import.meta.env.VITE_PALENGKE_PAYMENT_CONTRACT_ID },
  { key: 'VITE_UTANG_ESCROW_CONTRACT_ID', value: import.meta.env.VITE_UTANG_ESCROW_CONTRACT_ID },
  { key: 'VITE_FEE_BUMP_URL', value: import.meta.env.VITE_FEE_BUMP_URL },
];

export function AdminHealth() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const missingClientVars = useMemo(
    () => clientEnv.filter((entry) => !entry.value || entry.value === 'PLACEHOLDER'),
    [],
  );

  async function loadHealth() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/health');
      const data = await response.json() as HealthResponse;
      setHealth(data);
      if (!response.ok) setError(`Health endpoint returned HTTP ${response.status}`);
    } catch (err) {
      setHealth(null);
      setError(err instanceof Error ? err.message : 'Health endpoint unavailable');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadHealth();
  }, []);

  const apiOk = health?.status === 'ok';

  return (
    <div className="min-h-screen px-4 py-5" style={{ backgroundColor: '#F8FAFC' }}>
      <section className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Operations</p>
            <h1 className="text-2xl font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              System Health
            </h1>
          </div>
          <button
            onClick={() => void loadHealth()}
            className="w-11 h-11 rounded-2xl flex items-center justify-center active:scale-95"
            style={{ backgroundColor: '#E2E8F0', color: '#0F172A' }}
            aria-label="Refresh health"
            disabled={loading}
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <StatusCard
            title="Runtime health"
            value={health?.status ?? 'unknown'}
            ok={apiOk}
            detail={error ?? (health ? `Checked ${new Date(health.timestamp).toLocaleString()}` : 'Waiting for health endpoint')}
          />
          <StatusCard
            title="Client env"
            value={missingClientVars.length === 0 ? 'configured' : `${missingClientVars.length} missing`}
            ok={missingClientVars.length === 0}
            detail="Only public VITE variables are displayed here."
          />
          <StatusCard
            title="Payment proof"
            value="manual hash required"
            ok={false}
            detail="Final E2E still needs a wallet-signed Testnet transaction hash."
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-3xl bg-white p-5" style={{ border: '1.5px solid #E2E8F0' }}>
            <div className="flex items-center gap-2 mb-4">
              <ServerCog size={18} style={{ color: '#008055' }} />
              <h2 className="text-base font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                API checks
              </h2>
            </div>
            <div className="space-y-2">
              {(health?.checks ?? []).map((check) => (
                <div key={check.name} className="rounded-2xl p-4 flex items-start justify-between gap-4" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <div>
                    <p className="text-sm font-black text-slate-900">{check.name}</p>
                    <p className="text-xs text-slate-500 mt-1">HTTP {check.status}{check.detail ? ` · ${check.detail}` : ''}</p>
                  </div>
                  {check.ok ? <CheckCircle2 size={18} style={{ color: '#008055' }} /> : <AlertTriangle size={18} style={{ color: '#D97706' }} />}
                </div>
              ))}
              {!health?.checks?.length && (
                <p className="text-sm text-slate-500">
                  No health payload is available. Vite local dev may not serve Vercel API functions; verify with Vercel or deployed `/api/health`.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-3xl bg-white p-5" style={{ border: '1.5px solid #E2E8F0' }}>
            <h2 className="text-base font-black text-slate-900 mb-4" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              Public environment readiness
            </h2>
            <div className="space-y-2">
              {clientEnv.map((entry) => (
                <div key={entry.key} className="rounded-2xl p-4 flex items-center justify-between gap-4" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-400">{entry.key}</p>
                    <p className="text-sm font-mono text-slate-900 truncate">
                      {entry.value ? String(entry.value) : 'missing'}
                    </p>
                  </div>
                  {entry.value && entry.value !== 'PLACEHOLDER'
                    ? <CheckCircle2 size={18} style={{ color: '#008055' }} />
                    : <AlertTriangle size={18} style={{ color: '#D97706' }} />
                  }
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function StatusCard({ title, value, ok, detail }: { title: string; value: string; ok: boolean; detail: string }) {
  return (
    <div className="rounded-3xl bg-white p-5" style={{ border: '1.5px solid #E2E8F0' }}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">{title}</p>
        {ok ? <CheckCircle2 size={18} style={{ color: '#008055' }} /> : <AlertTriangle size={18} style={{ color: '#D97706' }} />}
      </div>
      <p className="text-xl font-black text-slate-900 mt-3" style={{ fontFamily: "'Montserrat', sans-serif" }}>{value}</p>
      <p className="text-xs text-slate-500 mt-2">{detail}</p>
    </div>
  );
}
