import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy, ExternalLink, FileSearch, RefreshCw, ShieldCheck } from 'lucide-react';
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
  const [copyStatus, setCopyStatus] = useState('');
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
  const dashboardStatus = error
    ? `Health check unavailable: ${error}`
    : loading
      ? 'Refreshing health and local receipt proof.'
      : health
        ? `Health checked ${new Date(health.timestamp).toLocaleString()} with ${health.status} status.`
        : 'Waiting for health endpoint and local receipt proof.';

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

  async function copyHash() {
    if (!smokeGuide.capturedHash) return;
    try {
      await navigator.clipboard.writeText(smokeGuide.capturedHash);
      setCopyStatus('Captured hash copied.');
    } catch {
      setCopyStatus(`Captured hash ready to copy: ${smokeGuide.capturedHash}`);
    }
  }

  useEffect(() => {
    void loadHealth();
  }, []);

  return (
    <div className="min-h-dvh px-4 py-5" style={{ backgroundColor: '#F8FAFC' }}>
      <section className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Operations</p>
            <h1 className="text-2xl font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              Proof Dashboard
            </h1>
          </div>
          <button
            type="button"
            onClick={() => { setRefreshKey((key) => key + 1); void loadHealth(); }}
            className="w-11 h-11 rounded-2xl flex items-center justify-center active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ backgroundColor: '#E2E8F0', color: '#0F172A' }}
            aria-label="Refresh proof dashboard"
            aria-busy={loading}
            disabled={loading}
          >
            <RefreshCw size={18} aria-hidden="true" className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <StatusCard title="Receipts" value={String(dashboard.recentReceipts.length)} detail="Saved on this device" ok={dashboard.recentReceipts.length > 0} />
          <StatusCard title="Contract rows" value={String(dashboard.sourceMix.contractRecords)} detail="PalengkePayment proof rows" ok={dashboard.sourceMix.contractRecords > 0} />
          <StatusCard title="Fallback rows" value={String(dashboard.sourceMix.horizonFallback)} detail="Need receipt confirmation" ok={dashboard.sourceMix.horizonFallback === 0} />
          <StatusCard title="Sponsor" value={dashboard.sponsorStatus.label} detail={dashboard.sponsorStatus.detail} ok={dashboard.sponsorStatus.severity === 'ok'} />
        </div>

        <div
          role="status"
          aria-label="Proof dashboard status"
          aria-live="polite"
          className="rounded-2xl p-4 text-sm font-semibold"
          style={{
            backgroundColor: error ? '#FFF7ED' : '#F0FDFA',
            border: `1px solid ${error ? '#FED7AA' : '#A7F3D0'}`,
            color: error ? '#9A3412' : '#047857',
          }}
        >
          {dashboardStatus}
        </div>

        <section className="rounded-3xl bg-white p-5" style={{ border: '1.5px solid #E2E8F0' }}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} aria-hidden="true" style={{ color: '#008055' }} />
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
          <ol className="grid gap-2 md:grid-cols-5" aria-label="Manual payment smoke checklist">
            {smokeGuide.steps.map((step) => (
              <li
                key={step.id}
                aria-label={`${step.label}: ${step.status}`}
                className="rounded-2xl p-3"
                style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}
              >
                <p className="text-xs font-black uppercase tracking-wider text-slate-400">{step.status}</p>
                <p className="text-sm font-black text-slate-900 mt-1">{step.label}</p>
              </li>
            ))}
          </ol>
          {!smokeGuide.capturedHash && (
            <div className="mt-4 rounded-2xl p-4" style={{ backgroundColor: '#FFF7ED', border: '1px solid #FED7AA' }}>
              <h3 className="text-sm font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                Manual smoke payment required
              </h3>
              <p className="text-xs text-orange-800 mt-2">
                Make one wallet-signed Testnet payment, refresh this dashboard, then confirm the same hash appears in customer history, the receipt route, and the vendor proof certificate.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <a
                  href="/customer/scan"
                  className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-xs font-black text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{ backgroundColor: '#008055' }}
                >
                  Start customer smoke
                </a>
                <a
                  href="/vendor/transactions"
                  className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-xs font-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{ color: '#008055', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0' }}
                >
                  Review vendor proof
                </a>
              </div>
            </div>
          )}
          {smokeGuide.capturedHash && (
            <div className="mt-4 rounded-2xl p-4" style={{ backgroundColor: '#0F172A' }}>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Captured hash</p>
              <p className="text-sm font-mono text-white break-words mt-2">{smokeGuide.capturedHash}</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                {smokeGuide.stellarExpertUrl && (
                  <a href={smokeGuide.stellarExpertUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl text-xs font-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ color: '#A7F3D0' }}>
                    <ExternalLink size={12} aria-hidden="true" /> Verify on Stellar Expert
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => void copyHash()}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-black active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{ color: '#0F172A', backgroundColor: '#A7F3D0' }}
                >
                  <Copy size={12} aria-hidden="true" /> Copy hash
                </button>
              </div>
              {copyStatus && (
                <p
                  role="status"
                  aria-label="Hash copy status"
                  aria-live="polite"
                  className="mt-3 rounded-xl px-3 py-2 text-xs font-black"
                  style={{ color: '#D1FAE5', backgroundColor: 'rgba(167,243,208,0.12)', border: '1px solid rgba(167,243,208,0.3)' }}
                >
                  {copyStatus}
                </p>
              )}
            </div>
          )}
          <div className="mt-4 rounded-2xl p-4" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <h3 className="text-sm font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              Proof review links
            </h3>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {smokeGuide.surfaces.map((surface) => (
                <a
                  key={surface.href}
                  href={surface.href}
                  className="group rounded-xl p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}
                >
                  <span className="flex items-center justify-between gap-2 text-xs font-black text-slate-900">
                    {surface.label}
                    <ExternalLink size={12} aria-hidden="true" className="shrink-0 text-slate-400 group-hover:text-slate-700" />
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">{surface.detail}</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-3xl bg-white p-5" style={{ border: '1.5px solid #E2E8F0' }}>
            <div className="flex items-center gap-2 mb-4">
              <FileSearch size={18} aria-hidden="true" style={{ color: '#008055' }} />
              <h2 className="text-base font-black text-slate-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                Recent Receipts
              </h2>
            </div>
            <div className="space-y-2">
              {dashboard.recentReceipts.map((receipt) => (
                <a
                  key={receipt.txHash}
                  href={receipt.receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open receipt ${receipt.txHash}`}
                  className="block rounded-2xl p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}
                >
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
                <div className="rounded-2xl p-4" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <p className="text-sm font-black text-slate-800">No saved receipts yet</p>
                  <p className="text-xs text-slate-500 mt-1">
                    The dashboard will populate after a signed Testnet payment stores one receipt proof on this device.
                  </p>
                </div>
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
        {ok ? <CheckCircle2 size={18} aria-hidden="true" style={{ color: '#008055' }} /> : <AlertTriangle size={18} aria-hidden="true" style={{ color: '#D97706' }} />}
      </div>
      <p className="text-lg font-black text-slate-900 mt-3 leading-tight break-words" style={{ fontFamily: "'Montserrat', sans-serif" }}>{value}</p>
      <p className="text-xs text-slate-500 mt-2">{detail}</p>
    </div>
  );
}
