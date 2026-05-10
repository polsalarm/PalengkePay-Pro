import { StellarWalletsKit, Networks } from '@creit.tech/stellar-wallets-kit';
import { buildPaymentTx, submitWithFeeBump } from './stellar';

export const PAYMENT_CONTRACT_ID = import.meta.env.VITE_PALENGKE_PAYMENT_CONTRACT_ID as string | undefined;
export const REGISTRY_CONTRACT_ID = import.meta.env.VITE_VENDOR_REGISTRY_CONTRACT_ID as string | undefined;
export const ESCROW_CONTRACT_ID = import.meta.env.VITE_UTANG_ESCROW_CONTRACT_ID as string | undefined;

export const contractsDeployed = !!(PAYMENT_CONTRACT_ID && REGISTRY_CONTRACT_ID && ESCROW_CONTRACT_ID);

export interface PaymentResult {
  txHash: string;
}

/** Send XLM payment via direct Horizon transfer (contract invocation added after deployment). */
export async function sendPayment(
  from: string,
  to: string,
  amountXlm: string,
  memo: string
): Promise<PaymentResult> {
  const xdr = await buildPaymentTx(from, to, amountXlm, memo);
  const signedXdr = await StellarWalletsKit.signTransaction(xdr, {
    networkPassphrase: Networks.TESTNET,
    address: from,
  });
  const result = await submitWithFeeBump(signedXdr.signedTxXdr);
  return { txHash: result.hash };
}
