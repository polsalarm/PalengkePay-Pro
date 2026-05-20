/**
 * Shared helpers for SEP-24 endpoints: JWT bearer extraction, transaction
 * serialization to SEP-24 spec format.
 */
import type { VercelRequest } from '@vercel/node';
import { verifyJwt, type SepJwtPayload } from './_jwt.js';
import type { RampTxn } from './_rampStore.js';

export function bearer(req: VercelRequest): SepJwtPayload | null {
  const h = req.headers.authorization ?? '';
  if (!h.startsWith('Bearer ')) return null;
  return verifyJwt(h.slice(7));
}

export function toSepShape(txn: RampTxn) {
  return {
    id: txn.id,
    kind: txn.kind,
    status: txn.status,
    status_eta: undefined,
    amount_in: txn.amountIn,
    amount_in_asset: txn.kind === 'withdraw' ? `stellar:native` : 'iso4217:PHP',
    amount_out: txn.amountOut,
    amount_out_asset: txn.kind === 'withdraw' ? 'iso4217:PHP' : `stellar:native`,
    amount_fee: txn.amountFee ?? '0',
    amount_fee_asset: txn.kind === 'withdraw' ? 'iso4217:PHP' : `stellar:native`,
    started_at: new Date(txn.startedAt).toISOString(),
    completed_at: txn.completedAt ? new Date(txn.completedAt).toISOString() : undefined,
    stellar_transaction_id: txn.stellarTxHash,
    external_transaction_id: txn.externalTxId,
    message: txn.message,
    refunded: false,
  };
}
