import { useState, useCallback } from 'react';
import {
  NETWORK_PASSPHRASE,
  addressToScVal,
  buildPaymentTx,
  i128ToScVal,
  prepareContractTx,
  stringToScVal,
  submitSorobanTx,
  submitWithFeeBump,
} from '../stellar';
import {
  getPaymentContractId,
  resolvePaymentSettlementMode,
  xlmToStroops,
} from '../payment-routing';
import { getPaymentFailureDetails } from '../payment-diagnostics';
import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit';

export type TxStatus = 'idle' | 'building' | 'signing' | 'submitting' | 'confirmed' | 'failed';

export interface PaymentState {
  status: TxStatus;
  txHash: string | null;
  error: string | null;
  diagnostic: string | null;
}

export function usePayment() {
  const paymentContractId = getPaymentContractId();
  const settlementMode = resolvePaymentSettlementMode(paymentContractId);
  const [state, setState] = useState<PaymentState>({
    status: 'idle',
    txHash: null,
    error: null,
    diagnostic: null,
  });

  const sendPayment = useCallback(async (
    from: string,
    to: string,
    amount: string,
    memo?: string
  ) => {
    try {
      setState({ status: 'building', txHash: null, error: null, diagnostic: null });
      const xdr = settlementMode === 'contract' && paymentContractId
        ? await prepareContractTx(from, paymentContractId, 'pay', [
          addressToScVal(from),
          addressToScVal(to),
          i128ToScVal(xlmToStroops(amount)),
          stringToScVal(memo?.trim() ?? ''),
        ])
        : await buildPaymentTx(from, to, amount, memo);

      setState((s) => ({ ...s, status: 'signing' }));
      const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
        networkPassphrase: NETWORK_PASSPHRASE,
        address: from,
      });

      setState((s) => ({ ...s, status: 'submitting' }));
      const txHash = settlementMode === 'contract'
        ? await submitSorobanTx(signedTxXdr)
        : (await submitWithFeeBump(signedTxXdr)).hash;

      setState({ status: 'confirmed', txHash, error: null, diagnostic: null });
    } catch (err: unknown) {
      const details = getPaymentFailureDetails(err);
      setState({ status: 'failed', txHash: null, error: details.message, diagnostic: details.diagnostic });
    }
  }, [paymentContractId, settlementMode]);

  const reset = useCallback(() => {
    setState({ status: 'idle', txHash: null, error: null, diagnostic: null });
  }, []);

  return { ...state, settlementMode, sendPayment, reset };
}
