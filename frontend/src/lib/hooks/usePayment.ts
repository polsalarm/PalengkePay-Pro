import { useState, useCallback } from 'react';
import {
  NETWORK_PASSPHRASE,
  addressToScVal,
  buildPaymentTx,
  i128ToScVal,
  prepareContractTx,
  stringToScVal,
  submitSorobanTxAndDecode,
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
    memo?: string,
    opts?: { forceClassic?: boolean }
  ) => {
    try {
      setState({ status: 'building', txHash: null, error: null, diagnostic: null });
      // Anchor deposits (cashout) need a classic XLM payment op so the server-side
      // Horizon verifier in /api/ramp/cashout?action=settle can confirm the
      // transfer landed on the anchor account. Soroban contract invocations
      // produce invoke_host_function ops which the verifier cannot detect.
      const useContract = !opts?.forceClassic && settlementMode === 'contract' && paymentContractId;
      const xdr = useContract
        ? await prepareContractTx(from, paymentContractId!, 'pay', [
          addressToScVal(from),
          addressToScVal(to),
          i128ToScVal(xlmToStroops(amount)),
          stringToScVal(memo?.trim() ?? ''),
        ])
        : await buildPaymentTx(from, to, amount, memo, opts?.forceClassic);

      setState((s) => ({ ...s, status: 'signing' }));
      const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
        networkPassphrase: NETWORK_PASSPHRASE,
        address: from,
      });

      setState((s) => ({ ...s, status: 'submitting' }));
      let txHash: string;
      if (useContract) {
        const { hash, returnValue } = await submitSorobanTxAndDecode(signedTxXdr);
        txHash = hash;
        // Best-effort: pull this real payment into the credit-score oracle.
        // Never blocks/throws into the payment flow — the payment itself
        // already succeeded regardless of whether this follow-up lands.
        if (typeof returnValue === 'bigint' || typeof returnValue === 'number') {
          fetch('/api/credit-autorepay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'record_payment', id: returnValue.toString() }),
          }).catch(() => {});
        }
      } else {
        txHash = (await submitWithFeeBump(signedTxXdr)).hash;
      }

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
