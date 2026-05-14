import type { PaymentProofRecord } from './payment-proof';
import type { PaymentHistoryRecord } from './payment-source';

export interface AdminHealthCheck {
  name: string;
  ok: boolean;
  status: number;
  detail?: string;
}

export interface AdminProofDashboardInput {
  proofs: PaymentProofRecord[];
  payments: PaymentHistoryRecord[];
  healthChecks?: AdminHealthCheck[];
  paymentErrors?: string[];
}

interface DashboardSeverity {
  label: string;
  severity: 'ok' | 'warning' | 'danger';
  detail: string;
}

interface DashboardDiagnostic {
  title: string;
  severity: 'warning' | 'danger';
  detail: string;
}

export function buildAdminProofDashboard(input: AdminProofDashboardInput) {
  const sponsorCheck = input.healthChecks?.find((check) => check.name === 'sponsor_rate_limit');

  return {
    recentReceipts: input.proofs
      .slice()
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .map((proof) => ({
        txHash: proof.txHash,
        receiptUrl: `/receipt/${encodeURIComponent(proof.txHash)}`,
        customerWallet: proof.from,
        vendorWallet: proof.to,
        phpAmount: proof.quote.phpAmount,
        xlmAmount: proof.amountXlm,
        createdAt: proof.createdAt,
        settlementMode: proof.settlementMode,
      })),
    sourceMix: buildSourceMix(input.payments),
    sponsorStatus: getSponsorStatus(sponsorCheck),
    failedPaymentDiagnostics: (input.paymentErrors ?? []).map(getPaymentDiagnostic),
  };
}

function buildSourceMix(payments: PaymentHistoryRecord[]) {
  const contractRecords = payments.filter((payment) => payment.source === 'palengke-payment').length;
  const horizonFallback = payments.filter((payment) => payment.source !== 'palengke-payment').length;

  return {
    contractRecords,
    horizonFallback,
    mixedUnverified: contractRecords > 0 && horizonFallback > 0 ? 1 : 0,
    totalRows: payments.length,
  };
}

function getSponsorStatus(check: AdminHealthCheck | undefined): DashboardSeverity {
  if (!check) {
    return {
      label: 'Sponsor limiter unknown',
      severity: 'warning',
      detail: 'Health endpoint did not return sponsor rate-limit readiness.',
    };
  }

  if (check.ok) {
    return {
      label: 'Durable limiter healthy',
      severity: 'ok',
      detail: check.detail ?? 'Durable sponsor limiter is responding.',
    };
  }

  return {
    label: 'Sponsor limiter degraded',
    severity: 'danger',
    detail: check.detail ?? 'Sponsor limiter health check is failing.',
  };
}

function getPaymentDiagnostic(error: string): DashboardDiagnostic {
  if (error.includes('Too many fee-bump requests')) {
    return {
      title: 'Sponsor rate limit',
      severity: 'warning',
      detail: 'The sponsor is throttling requests. Ask the customer to wait and submit one fresh payment.',
    };
  }

  if (error.includes('sponsor not configured') || error.includes('Sponsor not configured')) {
    return {
      title: 'Sponsor not configured',
      severity: 'danger',
      detail: 'Fee-bump sponsorship is missing required environment configuration.',
    };
  }

  return {
    title: 'Payment proof needs review',
    severity: 'warning',
    detail: error,
  };
}
