import { StellarWalletsKit, Networks } from '@creit.tech/stellar-wallets-kit';
import {
  addressToScVal,
  buildPaymentTx,
  i128ToScVal,
  prepareContractTx,
  stringToScVal,
  submitSorobanTx,
  submitWithFeeBump,
} from './stellar';
import { resolvePaymentSettlementMode, xlmToStroops } from './payment-routing';

export const PAYMENT_CONTRACT_ID = import.meta.env.VITE_PALENGKE_PAYMENT_CONTRACT_ID as string | undefined;
export const REGISTRY_CONTRACT_ID = import.meta.env.VITE_VENDOR_REGISTRY_CONTRACT_ID as string | undefined;
export const ESCROW_CONTRACT_ID = import.meta.env.VITE_UTANG_ESCROW_CONTRACT_ID as string | undefined;

export const contractsDeployed = !!(PAYMENT_CONTRACT_ID && REGISTRY_CONTRACT_ID && ESCROW_CONTRACT_ID);

export interface PaymentResult {
  txHash: string;
}

/** Send XLM payment through PalengkePayment when configured, otherwise fallback to fee-bumped Horizon transfer. */
export async function sendPayment(
  from: string,
  to: string,
  amountXlm: string,
  memo: string
): Promise<PaymentResult> {
  const settlementMode = resolvePaymentSettlementMode(PAYMENT_CONTRACT_ID);
  const xdr = settlementMode === 'contract' && PAYMENT_CONTRACT_ID
    ? await prepareContractTx(from, PAYMENT_CONTRACT_ID, 'pay', [
      addressToScVal(from),
      addressToScVal(to),
      i128ToScVal(xlmToStroops(amountXlm)),
      stringToScVal(memo.trim()),
    ])
    : await buildPaymentTx(from, to, amountXlm, memo);
  const signedXdr = await StellarWalletsKit.signTransaction(xdr, {
    networkPassphrase: Networks.TESTNET,
    address: from,
  });
  const txHash = settlementMode === 'contract'
    ? await submitSorobanTx(signedXdr.signedTxXdr)
    : (await submitWithFeeBump(signedXdr.signedTxXdr)).hash;

  return { txHash };
}
