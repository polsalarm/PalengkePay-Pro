import type { PaymentProofRecord } from './payment-proof';
import { stellarExpertUrl } from './stellar';

type SmokeStepStatus = 'todo' | 'blocked' | 'done';
type SmokeGuideStatus = 'needs_hash' | 'ready';

interface SmokeStep {
  id: string;
  label: string;
  status: SmokeStepStatus;
}

interface SmokeSurface {
  label: string;
  href: string;
  detail: string;
}

interface TestnetPaymentSmokeGuide {
  status: SmokeGuideStatus;
  capturedHash: string | null;
  stellarExpertUrl: string | null;
  surfaces: SmokeSurface[];
  steps: SmokeStep[];
}

export function buildTestnetPaymentSmokeGuide(proofs: PaymentProofRecord[]): TestnetPaymentSmokeGuide {
  const latestProof = [...proofs]
    .filter((proof) => proof.txHash.trim())
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] ?? null;

  if (!latestProof) {
    return {
      status: 'needs_hash',
      capturedHash: null,
      stellarExpertUrl: null,
      surfaces: [
        {
          label: 'Start customer smoke',
          href: '/customer/scan',
          detail: 'Make one wallet-signed Testnet payment from a funded customer wallet.',
        },
        {
          label: 'Review vendor proof',
          href: '/vendor/transactions',
          detail: 'Confirm the vendor income proof certificate updates after the payment lands.',
        },
        {
          label: 'Refresh admin proof',
          href: '/admin/proofs',
          detail: 'Return here after the payment stores a local receipt proof.',
        },
      ],
      steps: [
        { id: 'connect-funded-wallet', label: 'Connect a funded Testnet wallet', status: 'todo' },
        { id: 'make-testnet-payment', label: 'Complete one wallet-signed Testnet payment', status: 'todo' },
        { id: 'customer-history-proof', label: 'Confirm customer history shows the payment hash', status: 'blocked' },
        { id: 'receipt-page-proof', label: 'Open the receipt proof route for the hash', status: 'blocked' },
        { id: 'vendor-export-proof', label: 'Confirm vendor proof export includes the hash', status: 'blocked' },
      ],
    };
  }

  return {
    status: 'ready',
    capturedHash: latestProof.txHash,
    stellarExpertUrl: stellarExpertUrl(latestProof.txHash),
    surfaces: [
      {
        label: 'Customer history',
        href: '/customer/history',
        detail: 'Confirm the customer sees the saved PHP quote and transaction hash.',
      },
      {
        label: 'Receipt page',
        href: `/receipt/${encodeURIComponent(latestProof.txHash)}`,
        detail: 'Open the shareable receipt proof for the same hash.',
      },
      {
        label: 'Vendor certificate',
        href: '/vendor/transactions',
        detail: 'Confirm the lender/co-op income proof certificate includes the hash.',
      },
    ],
    steps: [
      { id: 'connect-funded-wallet', label: 'Connect a funded Testnet wallet', status: 'done' },
      { id: 'make-testnet-payment', label: 'Complete one wallet-signed Testnet payment', status: 'done' },
      { id: 'customer-history-proof', label: 'Confirm customer history shows the payment hash', status: 'done' },
      { id: 'receipt-page-proof', label: 'Open the receipt proof route for the hash', status: 'done' },
      { id: 'vendor-export-proof', label: 'Confirm vendor proof export includes the hash', status: 'done' },
    ],
  };
}
