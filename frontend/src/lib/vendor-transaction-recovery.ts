import type { PaymentHistoryRecord } from './payment-source';
import { stellarExpertUrl } from './stellar';

export interface ReceiptReference {
  label: string;
  value: string;
  lookupUrl: string | null;
  detail: string;
}

export interface RecoveryCallToAction {
  title: string;
  detail: string;
  actionLabel: string;
  actionPath: string;
}

export interface FeeBumpDiagnostic {
  title: string;
  detail: string;
  actionLabel: string;
}

export interface VendorRecoverySummary {
  receiptLookup: {
    availableCount: number;
    latestReference: string | null;
    latestUrl: string | null;
    detail: string;
  };
  resend: RecoveryCallToAction;
  feeBumpDiagnostic: FeeBumpDiagnostic;
}

export function getTransactionReceiptReference(payment: PaymentHistoryRecord): ReceiptReference {
  if (payment.txHash) {
    return {
      label: 'Transaction hash',
      value: payment.txHash,
      lookupUrl: stellarExpertUrl(payment.txHash),
      detail: 'Open Stellar Expert to verify the submitted transaction.',
    };
  }

  if (payment.paymentId !== undefined) {
    return {
      label: 'Contract payment ID',
      value: `#${payment.paymentId}`,
      lookupUrl: null,
      detail: 'Use this PalengkePayment record ID when reconciling contract history.',
    };
  }

  return {
    label: 'Proof reference',
    value: payment.id,
    lookupUrl: null,
    detail: 'Use this fallback reference when comparing local history and sponsor logs.',
  };
}

export function buildVendorRecoverySummary(
  transactions: PaymentHistoryRecord[],
  loadError?: string | null,
): VendorRecoverySummary {
  const references = transactions.map(getTransactionReceiptReference);
  const latestWithHash = references.find((reference) => reference.lookupUrl);
  const latestReference = latestWithHash ?? references[0] ?? null;
  const fallbackCount = transactions.filter((payment) => payment.source === 'fee-bump').length;

  return {
    receiptLookup: {
      availableCount: references.length,
      latestReference: latestReference?.value ?? null,
      latestUrl: latestWithHash?.lookupUrl ?? null,
      detail: latestReference
        ? latestReference.detail
        : 'No local receipt reference is available yet. Ask the customer to retry, then refresh this page.',
    },
    resend: {
      title: 'Need the customer to resend?',
      detail: 'Open your QR and ask the customer to start a fresh payment. Vendors should not manually replay failed customer submissions.',
      actionLabel: 'Share QR again',
      actionPath: '/vendor/qr',
    },
    feeBumpDiagnostic: getFeeBumpDiagnostic(loadError, fallbackCount),
  };
}

function getFeeBumpDiagnostic(loadError: string | null | undefined, fallbackCount: number): FeeBumpDiagnostic {
  const raw = loadError ?? '';

  if (raw.includes('Too many fee-bump requests')) {
    return {
      title: 'Sponsor rate limit',
      detail: 'The gasless sponsor is throttling requests. Ask the customer to wait, then submit one fresh payment from the QR.',
      actionLabel: 'Share QR for retry',
    };
  }

  if (raw.includes('Fee bump sponsor not configured')) {
    return {
      title: 'Sponsor not configured',
      detail: 'Gasless submission is unavailable. No vendor funds are confirmed until a receipt hash or contract record appears.',
      actionLabel: 'Check setup, then retry',
    };
  }

  if (fallbackCount > 0) {
    return {
      title: 'Fee-bump records need receipt confirmation',
      detail: 'This history includes Horizon/cache fallback rows from the fee-bump path. Confirm the receipt hash before treating it as contract-backed proof.',
      actionLabel: 'Review receipts',
    };
  }

  return {
    title: 'Contract-first recovery',
    detail: 'Use the contract payment ID or transaction hash shown on each row when a customer asks about a missing receipt.',
    actionLabel: 'Review history',
  };
}
