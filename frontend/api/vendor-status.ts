import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Keypair, Transaction, TransactionBuilder } from '@stellar/stellar-sdk';
import { getStatus, getStatuses, setStatus } from './_statusStore.js';
import { getLiquidityProfile } from './liquidity-profile.js';

const MEMO_PREFIX = 'PPSTAT:';
const REPLAY_WINDOW_SECONDS = 300;

function networkPassphrase(): string {
  return getLiquidityProfile().networkPassphrase;
}

function readMemoText(tx: Transaction): string | null {
  const memo = tx.memo;
  if (!memo || memo.type !== 'text') return null;
  const value = memo.value;
  if (typeof value === 'string') return value;
  if (value instanceof Uint8Array) return Buffer.from(value).toString('utf8');
  return null;
}

function verifySourceSignature(tx: Transaction): boolean {
  const sourceKp = Keypair.fromPublicKey(tx.source);
  const sourceHint = Buffer.from(sourceKp.rawPublicKey()).subarray(-4);
  return tx.signatures.some((sig) => {
    const hint = Buffer.from(sig.hint());
    if (!hint.equals(sourceHint)) return false;
    return sourceKp.verify(tx.hash(), sig.signature());
  });
}

function publicStatus(rec: { isOpen: boolean; updatedAt: number } | null) {
  return rec
    ? { isOpen: rec.isOpen, defaulted: false, updatedAt: rec.updatedAt }
    : { isOpen: true, defaulted: true };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const raw = (req.query.vendors ?? req.query.vendor) as string | string[] | undefined;
    const flat = Array.isArray(raw) ? raw.join(',') : raw;
    if (!flat) return res.status(400).json({ error: 'vendor required' });
    const list = flat.split(',').map((s) => s.trim()).filter(Boolean);
    if (list.length === 0) return res.status(400).json({ error: 'vendor required' });

    for (const addr of list) {
      try { Keypair.fromPublicKey(addr); } catch {
        return res.status(400).json({ error: `invalid address: ${addr}` });
      }
    }

    if (list.length === 1) {
      const rec = await getStatus(list[0]);
      return res.status(200).json(publicStatus(rec));
    }
    const map = await getStatuses(list);
    const statuses: Record<string, ReturnType<typeof publicStatus>> = {};
    for (const a of list) statuses[a] = publicStatus(map.get(a) ?? null);
    return res.status(200).json({ statuses });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { signedXdr } = (req.body ?? {}) as { signedXdr?: string };
  if (typeof signedXdr !== 'string' || !signedXdr.trim()) {
    return res.status(400).json({ error: 'signedXdr required' });
  }

  let tx: Transaction;
  try {
    const parsed = TransactionBuilder.fromXDR(signedXdr, networkPassphrase());
    if (!(parsed instanceof Transaction)) {
      return res.status(400).json({ error: 'fee-bump transactions not accepted' });
    }
    tx = parsed;
  } catch {
    return res.status(400).json({ error: 'invalid signedXdr' });
  }

  try { Keypair.fromPublicKey(tx.source); } catch {
    return res.status(400).json({ error: 'invalid transaction source' });
  }

  if (!verifySourceSignature(tx)) {
    return res.status(400).json({ error: 'signature must be from vendor source account' });
  }

  const memoText = readMemoText(tx);
  if (!memoText || !memoText.startsWith(MEMO_PREFIX)) {
    return res.status(400).json({ error: 'PPSTAT memo required' });
  }
  const parts = memoText.slice(MEMO_PREFIX.length).split(':');
  const flag = parts[0];
  if (flag !== '0' && flag !== '1') {
    return res.status(400).json({ error: 'invalid status flag' });
  }

  const tb = tx.timeBounds;
  if (!tb) return res.status(400).json({ error: 'timeBounds required' });
  const now = Math.floor(Date.now() / 1000);
  const maxTime = Number(tb.maxTime);
  const minTime = Number(tb.minTime);
  if (!Number.isFinite(maxTime) || maxTime === 0) {
    return res.status(400).json({ error: 'maxTime required' });
  }
  if (maxTime < now - REPLAY_WINDOW_SECONDS) {
    return res.status(400).json({ error: 'challenge expired' });
  }
  if (Number.isFinite(minTime) && minTime > now + REPLAY_WINDOW_SECONDS) {
    return res.status(400).json({ error: 'challenge not yet valid' });
  }

  const rec = { isOpen: flag === '1', updatedAt: Date.now() };
  await setStatus(tx.source, rec);
  return res.status(200).json({ ok: true, ...publicStatus(rec) });
}
