import type { VercelRequest, VercelResponse } from '@vercel/node';
import { bearer, toSepShape } from './_sep24Common.js';
import { createTxn, getTxn, listForWallet } from './_rampStore.js';
import { getDepositAddress, isMock } from './_pdax.js';
import { isMainnet } from './_network.js';

/**
 * Consolidated SEP-24 dispatcher.
 *
 * Vercel Hobby plan caps Serverless Functions at 12 per deployment, so the
 * separate /api/sep24/* files are collapsed into one handler that routes on
 * the `_op` query param (set by vercel.json rewrites).
 *
 *   /api/sep24/info                                  → _op=info
 *   /api/sep24/transactions/deposit/interactive      → _op=deposit-interactive
 *   /api/sep24/transactions/withdraw/interactive     → _op=withdraw-interactive
 *   /api/sep24/transaction                           → _op=transaction
 *   /api/sep24/transactions                          → _op=transactions
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (isMainnet()) {
    return res.status(503).json({
      error: 'SEP-24 anchor is not available on mainnet (PDAX integration is mocked, testnet-only).',
    });
  }
  const op = (req.query._op as string | undefined) ?? '';

  if (op === 'info') return info(res);
  if (op === 'deposit-interactive') return depositInteractive(req, res);
  if (op === 'withdraw-interactive') return withdrawInteractive(req, res);
  if (op === 'transaction') return transaction(req, res);
  if (op === 'transactions') return transactions(req, res);
  return res.status(404).json({ error: `unknown sep24 op: ${op}` });
}

function info(res: VercelResponse) {
  return res.status(200).json({
    deposit: {
      native: { enabled: true, fee_fixed: 0, fee_percent: 1.0, min_amount: 50, max_amount: 100000 },
    },
    withdraw: {
      native: {
        enabled: true, fee_fixed: 0, fee_percent: 1.0, min_amount: 50, max_amount: 100000,
        types: {
          bank_account: { fields: { dest: { description: 'Bank account number or e-wallet handle' }, dest_extra: { description: 'Bank code (BPI, BDO, GCASH, MAYA, UB)', optional: false } } },
        },
      },
    },
    fee: { enabled: false },
    features: { account_creation: true, claimable_balances: false },
  });
}

async function depositInteractive(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const jwt = bearer(req);
  if (!jwt) return res.status(401).json({ error: 'sep10 jwt required' });
  const body = (req.body ?? {}) as Record<string, string>;
  const asset = body.asset_code ?? body.asset ?? 'native';
  if (asset !== 'native') return res.status(400).json({ error: 'only native (XLM) supported' });
  const amount = body.amount ?? '0';
  const wallet = body.account ?? jwt.sub;
  const txn = await createTxn({ wallet, kind: 'deposit', status: 'incomplete', asset: 'native', amountIn: amount });
  const origin = process.env.ANCHOR_BASE_URL ?? `https://${req.headers.host ?? 'palengkepay-pro.vercel.app'}`;
  return res.status(200).json({
    type: 'interactive_customer_info_needed',
    url: `${origin}/customer/cashin?txn=${txn.id}&amount=${encodeURIComponent(amount)}`,
    id: txn.id,
  });
}

async function withdrawInteractive(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const jwt = bearer(req);
  if (!jwt) return res.status(401).json({ error: 'sep10 jwt required' });
  const body = (req.body ?? {}) as Record<string, string>;
  const asset = body.asset_code ?? body.asset ?? 'native';
  if (asset !== 'native') return res.status(400).json({ error: 'only native (XLM) supported' });
  const amount = body.amount ?? '0';
  const wallet = body.account ?? jwt.sub;
  const txn = await createTxn({ wallet, kind: 'withdraw', status: 'pending_user_transfer_start', asset: 'native', amountIn: amount });
  const dep = await getDepositAddress('XLM', txn.id);
  const origin = process.env.ANCHOR_BASE_URL ?? `https://${req.headers.host ?? 'palengkepay-pro.vercel.app'}`;
  return res.status(200).json({
    type: 'interactive_customer_info_needed',
    url: `${origin}/customer/cashout?txn=${txn.id}&amount=${encodeURIComponent(amount)}`,
    id: txn.id,
    account_id: dep.address,
    memo: dep.memo,
    memo_type: dep.memoType.toLowerCase(),
    mock: isMock() || undefined,
  });
}

async function transaction(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  const jwt = bearer(req);
  if (!jwt) return res.status(401).json({ error: 'sep10 jwt required' });
  const id = (req.query.id as string | undefined) ?? '';
  if (!id) return res.status(400).json({ error: 'id required' });
  const txn = await getTxn(id);
  if (!txn) return res.status(404).json({ error: 'not found' });
  if (txn.wallet !== jwt.sub) return res.status(403).json({ error: 'forbidden' });
  return res.status(200).json({ transaction: toSepShape(txn) });
}

async function transactions(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  const jwt = bearer(req);
  if (!jwt) return res.status(401).json({ error: 'sep10 jwt required' });
  const kind = req.query.kind as string | undefined;
  let txns = await listForWallet(jwt.sub);
  if (kind === 'deposit' || kind === 'withdraw') txns = txns.filter((t) => t.kind === kind);
  return res.status(200).json({ transactions: txns.map(toSepShape) });
}
