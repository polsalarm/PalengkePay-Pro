import type { PaymentProofRecord } from './payment-proof';

type SmokeStepStatus = 'todo' | 'blocked' | 'done';
type SmokeGuideStatus = 'needs_hash' | 'ready';

interface SmokeStep {
  id: string;
  label: string;
  status: SmokeStepStatus;
}

interface TestnetPaymentSmokeGuide {
  status: SmokeGuideStatus;
  capturedHash: string | null;
  stellarExpertUrl: string | null;
  steps: SmokeStep[];
}

const STELLAR_EXPERT_TESTNET_TX = 'https://stellar.expert/explorer/testnet/tx';

export function buildTestnetPaymentSmokeGuide(proofs: PaymentProofRecord[]): TestnetPaymentSmokeGuide {
  const latestProof = [...proofs]
    .filter((proof) => proof.txHash.trim())
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] ?? null;

  if (!latestProof) {
    return {
      status: 'needs_hash',
      capturedHash: null,
      stellarExpertUrl: null,
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
    stellarExpertUrl: `${STELLAR_EXPERT_TESTNET_TX}/${latestProof.txHash}`,
    steps: [
      { id: 'connect-funded-wallet', label: 'Connect a funded Testnet wallet', status: 'done' },
      { id: 'make-testnet-payment', label: 'Complete one wallet-signed Testnet payment', status: 'done' },
      { id: 'customer-history-proof', label: 'Confirm customer history shows the payment hash', status: 'done' },
      { id: 'receipt-page-proof', label: 'Open the receipt proof route for the hash', status: 'done' },
      { id: 'vendor-export-proof', label: 'Confirm vendor proof export includes the hash', status: 'done' },
    ],
  };
}
