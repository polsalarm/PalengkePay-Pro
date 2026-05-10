import { useState, useCallback } from 'react';
import { buildPaymentTx, submitWithFeeBump } from '../stellar';
import { StellarWalletsKit, Networks } from '@creit.tech/stellar-wallets-kit';

export type TxStatus = 'idle' | 'building' | 'signing' | 'submitting' | 'confirmed' | 'failed';

export interface PaymentState {
  status: TxStatus;
  txHash: string | null;
  error: string | null;
}

export function usePayment() {
  const [state, setState] = useState<PaymentState>({
    status: 'idle',
    txHash: null,
    error: null,
  });

  const sendPayment = useCallback(async (
    from: string,
    to: string,
    amount: string,
    memo?: string
  ) => {
    try {
      setState({ status: 'building', txHash: null, error: null });
      const xdr = await buildPaymentTx(from, to, amount, memo);

      setState((s) => ({ ...s, status: 'signing' }));
      const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
        networkPassphrase: Networks.TESTNET,
        address: from,
      });

      setState((s) => ({ ...s, status: 'submitting' }));
      const result = await submitWithFeeBump(signedTxXdr);

      setState({ status: 'confirmed', txHash: result.hash, error: null });
    } catch (err: unknown) {
      const message = parseWalletError(err);
      setState({ status: 'failed', txHash: null, error: message });
    }
  }, []);

  const reset = useCallback(() => {
    setState({ status: 'idle', txHash: null, error: null });
  }, []);

  return { ...state, sendPayment, reset };
}

function parseWalletError(err: unknown): string {
  if (!err) return 'Unknown error';

  // Extract Horizon result_codes from stellar-sdk 400 errors
  type HorizonErr = { response?: { data?: { extras?: { result_codes?: { transaction?: string; operations?: string[] } } } } };
  const rc = (err as HorizonErr).response?.data?.extras?.result_codes;
  if (rc) {
    const tx = rc.transaction;
    const ops = rc.operations ?? [];
    if (tx === 'tx_bad_seq')         return 'Sequence error — please try again';
    if (tx === 'tx_insufficient_fee') return 'Network fee too low — please try again';
    if (tx === 'tx_bad_auth')        return 'Invalid signature — reconnect wallet';
    if (ops.includes('op_no_destination')) return 'Vendor account not activated on Stellar testnet';
    if (ops.includes('op_underfunded'))    return 'Insufficient XLM balance';
    if (ops.includes('op_low_reserve'))    return 'Account below minimum XLM reserve';
    return `Transaction failed: ${tx ?? ops.join(', ') ?? 'unknown'}`;
  }

  const msg = (err as { message?: string }).message ?? String(err);
  if (msg.includes('rejected') || msg.includes('cancel') || msg.includes('denied')) {
    return 'Transaction cancelled — no funds sent';
  }
  if (msg.includes('network') || msg.includes('Network')) {
    return 'Please switch to Stellar Testnet';
  }
  if (msg.includes('balance') || msg.includes('insufficient')) {
    return 'Insufficient XLM balance';
  }
  if (msg.includes('timeout') || msg.includes('Timeout')) {
    return 'Transaction timed out — tap to retry';
  }
  return msg.slice(0, 120);
}
