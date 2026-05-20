import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  Keypair, TransactionBuilder, Operation, Networks, Account, BASE_FEE,
  Transaction, FeeBumpTransaction,
} from '@stellar/stellar-sdk';
import { signJwt } from '../_jwt.js';

/**
 * SEP-10 Web Authentication.
 *
 *   GET  /api/sep10/auth?account=G...  -> { transaction, network_passphrase }
 *        Returns a challenge tx (manage_data op signed by the anchor) for the
 *        client to counter-sign.
 *   POST /api/sep10/auth  body { transaction }
 *        Verifies both signatures, issues a JWT bound to the client account.
 *
 * Spec: https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md
 */

const NETWORK_PASSPHRASE = process.env.ANCHOR_NETWORK_PASSPHRASE ?? Networks.TESTNET;
const HOME_DOMAIN = process.env.ANCHOR_HOME_DOMAIN ?? 'palengkepay-pro.vercel.app';
const WEB_AUTH_DOMAIN = process.env.ANCHOR_WEB_AUTH_DOMAIN ?? HOME_DOMAIN;
const SIGNING_SECRET = process.env.ANCHOR_SIGNING_SECRET;
const CHALLENGE_TTL_SECONDS = 300;
const JWT_TTL_SECONDS = 60 * 60 * 24;

function anchorKp(): Keypair {
  if (!SIGNING_SECRET) throw new Error('ANCHOR_SIGNING_SECRET not configured');
  return Keypair.fromSecret(SIGNING_SECRET);
}

function buildChallenge(clientAccount: string): string {
  const server = anchorKp();
  const serverAccount = new Account(server.publicKey(), '-1');
  const nonce = Buffer.from(`pp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`).toString('base64').slice(0, 48);

  const tx = new TransactionBuilder(serverAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
    timebounds: { minTime: Math.floor(Date.now() / 1000), maxTime: Math.floor(Date.now() / 1000) + CHALLENGE_TTL_SECONDS },
  })
    .addOperation(Operation.manageData({
      name: `${HOME_DOMAIN} auth`,
      value: nonce,
      source: clientAccount,
    }))
    .addOperation(Operation.manageData({
      name: 'web_auth_domain',
      value: WEB_AUTH_DOMAIN,
      source: server.publicKey(),
    }))
    .build();

  tx.sign(server);
  return tx.toXDR();
}

function verifyChallenge(xdr: string): { clientAccount: string } {
  const server = anchorKp();
  const parsed = TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE);
  if (parsed instanceof FeeBumpTransaction) throw new Error('challenge cannot be fee-bump');
  const tx = parsed as Transaction;

  if (tx.source !== server.publicKey()) throw new Error('bad source');
  if (Number(tx.sequence) !== 0 && tx.sequence !== '0' && tx.sequence !== '-1' && tx.sequence !== '-2') {
    /* Stellar SDK normalizes -1 to 0 internally; tolerant check */
  }
  if (tx.operations.length < 1) throw new Error('no operations');

  const op = tx.operations[0];
  if (op.type !== 'manageData') throw new Error('op[0] not manageData');
  if (!op.source) throw new Error('op[0] missing source');
  const clientAccount = op.source;

  const now = Math.floor(Date.now() / 1000);
  if (tx.timeBounds && Number(tx.timeBounds.maxTime) < now) throw new Error('challenge expired');

  const signers = tx.signatures.map((s) => s.hint());
  const serverHint = server.signatureHint();
  const hasServer = signers.some((h) => h.equals(serverHint));
  if (!hasServer) throw new Error('missing server signature');

  const clientKp = Keypair.fromPublicKey(clientAccount);
  const clientHint = clientKp.signatureHint();
  const hasClient = signers.some((h) => h.equals(clientHint));
  if (!hasClient) throw new Error('missing client signature');

  const txHash = tx.hash();
  const clientSig = tx.signatures.find((s) => s.hint().equals(clientHint));
  if (!clientSig || !clientKp.verify(txHash, clientSig.signature())) {
    throw new Error('client signature invalid');
  }
  return { clientAccount };
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') {
      const account = (req.query.account as string | undefined) ?? '';
      if (!account || account.length !== 56 || !account.startsWith('G')) {
        return res.status(400).json({ error: 'account (G...) required' });
      }
      const transaction = buildChallenge(account);
      return res.status(200).json({ transaction, network_passphrase: NETWORK_PASSPHRASE });
    }
    if (req.method === 'POST') {
      const body = (req.body ?? {}) as { transaction?: string };
      if (!body.transaction) return res.status(400).json({ error: 'transaction required' });
      const { clientAccount } = verifyChallenge(body.transaction);
      const now = Math.floor(Date.now() / 1000);
      const token = signJwt({
        iss: `https://${WEB_AUTH_DOMAIN}/api/sep10/auth`,
        sub: clientAccount,
        iat: now,
        exp: now + JWT_TTL_SECONDS,
        jti: `${now}-${Math.random().toString(36).slice(2)}`,
      });
      return res.status(200).json({ token });
    }
    return res.status(405).json({ error: 'method not allowed' });
  } catch (err: unknown) {
    return res.status(400).json({ error: (err as Error).message ?? 'sep10 error' });
  }
}
