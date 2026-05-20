/**
 * Anchor Stellar wallet operations.
 *
 * Uses ANCHOR_SIGNING_SECRET as both the SEP-10 challenge signer and the
 * actual on-chain custody account for ramp deposits/withdrawals.
 *
 * Hackathon-grade: operator funds the anchor account on testnet and the
 * server signs payments directly. For mainnet this must move to a HSM/KMS.
 */
import {
  Horizon, Keypair, TransactionBuilder, Networks, Operation, Asset, Memo,
  BASE_FEE,
} from '@stellar/stellar-sdk';

const HORIZON_URL = process.env.ANCHOR_HORIZON_URL ?? 'https://horizon-testnet.stellar.org';
const NETWORK_PASSPHRASE = process.env.ANCHOR_NETWORK_PASSPHRASE ?? Networks.TESTNET;
const SIGNING_SECRET = process.env.ANCHOR_SIGNING_SECRET;

let cachedKp: Keypair | null = null;

export function isAnchorConfigured(): boolean {
  return Boolean(SIGNING_SECRET);
}

export function anchorPublicKey(): string {
  if (cachedKp) return cachedKp.publicKey();
  if (!SIGNING_SECRET) throw new Error('ANCHOR_SIGNING_SECRET not configured');
  cachedKp = Keypair.fromSecret(SIGNING_SECRET);
  return cachedKp.publicKey();
}

function getKp(): Keypair {
  if (!cachedKp) anchorPublicKey();
  return cachedKp!;
}

export interface SendResult {
  hash: string;
  ledger: number;
}

/**
 * Build, sign, and submit a payment from the anchor account to `destination`.
 * Creates the destination account if it doesn't exist on testnet.
 */
export async function sendPayment(destination: string, amountXlm: string, memo?: string): Promise<SendResult> {
  if (!SIGNING_SECRET) throw new Error('ANCHOR_SIGNING_SECRET not configured');
  const kp = getKp();
  const server = new Horizon.Server(HORIZON_URL);

  const [source, destExists] = await Promise.all([
    server.loadAccount(kp.publicKey()),
    server.loadAccount(destination).then(() => true).catch(() => false),
  ]);

  const amount = parseFloat(amountXlm).toFixed(7);
  const builder = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  if (destExists) {
    builder.addOperation(Operation.payment({
      destination,
      asset: Asset.native(),
      amount,
    }));
  } else {
    builder.addOperation(Operation.createAccount({
      destination,
      startingBalance: amount,
    }));
  }

  if (memo) builder.addMemo(Memo.text(memo.slice(0, 28)));

  const tx = builder.setTimeout(120).build();
  tx.sign(kp);

  const result = await server.submitTransaction(tx);
  return { hash: result.hash, ledger: result.ledger };
}

export interface IncomingVerification {
  valid: boolean;
  reason?: string;
  amountXlm?: string;
  memo?: string;
  sourceAccount?: string;
}

/**
 * Verify a Stellar transaction hash represents a payment of `expectedMemo`
 * to the anchor account. Used to validate cashout deposits before
 * triggering the fiat payout.
 */
export async function verifyIncomingPayment(txHash: string, expectedMemo: string): Promise<IncomingVerification> {
  try {
    const server = new Horizon.Server(HORIZON_URL);
    const anchor = anchorPublicKey();
    const tx = await server.transactions().transaction(txHash).call();

    if (!tx.successful) return { valid: false, reason: 'tx not successful' };
    const memo = tx.memo ?? '';
    if (memo !== expectedMemo) return { valid: false, reason: `memo mismatch (got "${memo}", expected "${expectedMemo}")` };

    const ops = await server.operations().forTransaction(txHash).limit(20).call();
    type Op = { type?: string; asset_type?: string; to?: string; amount?: string; source_account?: string; starting_balance?: string };
    const payment = (ops.records as Op[]).find((o) =>
      (o.type === 'payment' && o.asset_type === 'native' && o.to === anchor) ||
      (o.type === 'create_account' && o.to === anchor)
    );
    if (!payment) return { valid: false, reason: 'no payment to anchor in tx' };

    return {
      valid: true,
      amountXlm: payment.amount ?? payment.starting_balance,
      memo,
      sourceAccount: payment.source_account ?? tx.source_account,
    };
  } catch (err: unknown) {
    return { valid: false, reason: (err as Error).message ?? 'horizon lookup failed' };
  }
}
