import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, FileSearch, RefreshCw, ShieldCheck } from 'lucide-react';
import { buildAdminProofDashboard, type AdminHealthCheck } from '../../lib/admin-proof-dashboard';
import { buildTestnetPaymentSmokeGuide } from '../../lib/payment-smoke';
import { getAllPaymentProofs } from '../../lib/payment-proof';
import type { PaymentHistoryRecord } from '../../lib/payment-source';
import { formatPhp, formatXlm } from '../../lib/checkout-quote';
import { truncateAddress } from '../../lib/stellar';

interface HealthResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  checks: AdminHealthCheck[];
}

function proofsToPayments(proofs: ReturnType<typeof getAllPaymentProofs>): PaymentHistoryRecord[] {
  return proofs.map((proof) => ({
    id: `proof:${proof.txHash}`,
    txHash: proof.txHash,
    from: proof.from,
    to: proof.to,
    amountXlm: proof.amountXlm,
    createdAt: proof.createdAt,
    memo: proof.memo,
    source: proof.settlementMode === 'contract' ? 'palengke-payment' : 'fee-bump',
    quote: proof.quote,
  }));
}

export function AdminProofs() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const proofs = useMemo(() => {
    void refreshKey;
    return getAllPaymentProofs();
  }, [refreshKey]);
  const payments = useMemo(() => proofsToPayments(proofs), [proofs]);
  const dashboard = useMemo(() => buildAdminProofDashboard({
    proofs,
    payments,
    healthChecks: health?.checks,
    paymentErrors: error ? [error] : [],
  }), [error, health, payments, proofs]);
  const smokeGuide = useMemo(() => buildTestnetPaymentSmokeGuide(proofs), [proofs]);

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

  return (
    <div className="min-h-screen px-4 py-5" style={{ backgroundColor: '#F8FAFC' }}>
      <section className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Operations</p>
            <h1 className="text-2xl font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              Proof Dashboard
            </h1>
          </div>
          <button
            onClick={() => { setRefreshKey((key) => key + 1); void loadHealth(); }}
            className="w-11 h-11 rounded-2xl flex items-center justify-center active:scale-95"
            style={{ backgroundColor: '#E2E8F0', color: '#0F172A' }}
            aria-label="Refresh proof dashboard"
            disabled={loading}
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <StatusCard title="Receipts" value={String(dashboard.recentReceipts.length)} detail="Saved on this device" ok={dashboard.recentReceipts.length > 0} />
          <StatusCard title="Contract rows" value={String(dashboard.sourceMix.contractRecords)} detail="PalengkePayment proof rows" ok={dashboard.sourceMix.contractRecords > 0} />
          <StatusCard title="Fallback rows" value={String(dashboard.sourceMix.horizonFallback)} detail="Need receipt confirmation" ok={dashboard.sourceMix.horizonFallback === 0} />
          <StatusCard title="Sponsor" value={dashboard.sponsorStatus.label} detail={dashboard.sponsorStatus.detail} ok={dashboard.sponsorStatus.severity === 'ok'} />
        </div>

        <section className="rounded-3xl bg-white p-5" style={{ border: '1.5px solid #E2E8F0' }}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} style={{ color: '#008055' }} />
                <h2 className="text-base font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                  Testnet Payment Smoke Flow
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Capture one real wallet-signed hash, then verify it across customer history, receipt page, and vendor proof export.
              </p>
            </div>
            <span
              className="rounded-full px-3 py-1 text-xs font-black"
              style={{
                backgroundColor: smokeGuide.status === 'ready' ? '#ECFDF5' : '#FFF7ED',
                color: smokeGuide.status === 'ready' ? '#047857' : '#C2410C',
                border: `1px solid ${smokeGuide.status === 'ready' ? '#A7F3D0' : '#FED7AA'}`,
              }}
            >
              {smokeGuide.status === 'ready' ? 'Hash captured' : 'Needs real hash'}
            </span>
          </div>
          <div className="grid gap-2 md:grid-cols-5">
            {smokeGuide.steps.map((step) => (
              <div key={step.id} className="rounded-2xl p-3" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <p className="text-xs font-black uppercase tracking-wider text-slate-400">{step.status}</p>
                <p className="text-sm font-black text-slate-900 mt-1">{step.label}</p>
              </div>
            ))}
          </div>
          {smokeGuide.capturedHash && (
            <div className="mt-4 rounded-2xl p-4" style={{ backgroundColor: '#0F172A' }}>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Captured hash</p>
              <p className="text-sm font-mono text-white break-words mt-2">{smokeGuide.capturedHash}</p>
              {smokeGuide.stellarExpertUrl && (
                <a href={smokeGuide.stellarExpertUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs font-black mt-3" style={{ color: '#A7F3D0' }}>
                  <ExternalLink size={12} /> Verify on Stellar Expert
                </a>
              )}
            </div>
          )}
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-3xl bg-white p-5" style={{ border: '1.5px solid #E2E8F0' }}>
            <div className="flex items-center gap-2 mb-4">
              <FileSearch size={18} style={{ color: '#008055' }} />
              <h2 className="text-base font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                Recent Receipts
              </h2>
            </div>
            <div className="space-y-2">
              {dashboard.recentReceipts.map((receipt) => (
                <a key={receipt.txHash} href={receipt.receiptUrl} target="_blank" rel="noopener noreferrer" className="block rounded-2xl p-4" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <p className="text-xs font-mono font-bold text-slate-500 break-words">{receipt.txHash}</p>
                  <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                    <p className="font-black text-slate-900">{formatPhp(receipt.phpAmount)}</p>
                    <p className="font-black text-slate-900 text-right">{formatXlm(receipt.xlmAmount)}</p>
                    <p className="text-xs text-slate-500">{truncateAddress(receipt.customerWallet)}</p>
                    <p className="text-xs text-slate-500 text-right">{truncateAddress(receipt.vendorWallet)}</p>
                  </div>
                </a>
              ))}
              {dashboard.recentReceipts.length === 0 && (
                <p className="text-sm text-slate-500">No saved receipt proof exists on this device yet.</p>
              )}
            </div>
          </section>

          <section className="rounded-3xl bg-white p-5" style={{ border: '1.5px solid #E2E8F0' }}>
            <h2 className="text-base font-black text-slate-900 mb-4" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              Failed Payment Diagnostics
            </h2>
            <div className="space-y-2">
              {dashboard.failedPaymentDiagnostics.map((diagnostic) => (
                <div key={`${diagnostic.title}-${diagnostic.detail}`} className="rounded-2xl p-4" style={{ backgroundColor: diagnostic.severity === 'danger' ? '#FFF1F2' : '#FFF7ED', border: `1px solid ${diagnostic.severity === 'danger' ? '#FECDD3' : '#FED7AA'}` }}>
                  <p className="text-sm font-black text-slate-900">{diagnostic.title}</p>
                  <p className="text-xs text-slate-600 mt-1">{diagnostic.detail}</p>
                </div>
              ))}
              {dashboard.failedPaymentDiagnostics.length === 0 && (
                <p className="text-sm text-slate-500">No local failed payment diagnostics are pending.</p>
              )}
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
      <p className="text-lg font-black text-slate-900 mt-3 leading-tight" style={{ fontFamily: "'Montserrat', sans-serif" }}>{value}</p>
      <p className="text-xs text-slate-500 mt-2">{detail}</p>
    </div>
  );
}
