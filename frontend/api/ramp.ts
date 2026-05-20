import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createTxn, updateTxn, getTxn, listForWallet, listPending } from './_rampStore.js';
import { getDepositAddress, placeOrder, requestCashout, quoteCashin, withdrawCrypto } from './_pdax.js';
import { verifyIncomingPayment, isAnchorConfigured } from './_anchor.js';
import { fanout } from './_pushFanout.js';
import { getLiquidityProfile, quoteWithLiquidityMetadata } from './liquidity-profile.js';

/**
 * Consolidated ramp dispatcher.
 *
 * Vercel Hobby plan caps Serverless Functions at 12 per deployment, so the
 * individual /api/ramp/* files are collapsed into one handler dispatching
 * on the `_op` query param (set by vercel.json rewrites).
 *
 *   /api/ramp/cashout?action=create        → _op=cashout
 *   /api/ramp/cashin?action=quote          → _op=cashin
 *   /api/ramp/status                       → _op=status
 *   /api/ramp/admin                        → _op=admin
 */

const ADMIN_KEY = process.env.RAMP_ADMIN_KEY;

function adminAuthorized(req: VercelRequest): boolean {
  if (!ADMIN_KEY) return false;
  const provided = req.headers['x-admin-key'];
  return typeof provided === 'string' && provided === ADMIN_KEY;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const op = (req.query._op as string | undefined) ?? '';
  try {
    if (op === 'cashout') return await cashout(req, res);
    if (op === 'cashin') return await cashin(req, res);
    if (op === 'status') return await status(req, res);
    if (op === 'admin') return await admin(req, res);
    return res.status(404).json({ error: `unknown ramp op: ${op}` });
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message ?? 'ramp dispatcher failed' });
  }
}

// ── /api/ramp/cashout (XLM → PHP) ────────────────────────────────────────────

async function cashout(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const action = (req.query.action as string | undefined) ?? 'create';

  if (action === 'create') {
    const { wallet, amountXlm, rail, destination, beneficiaryName } = (req.body ?? {}) as Record<string, string>;
    if (!wallet || !amountXlm || !rail || !destination) {
      return res.status(400).json({ error: 'wallet, amountXlm, rail, destination required' });
    }
    if (wallet.length !== 56 || !wallet.startsWith('G')) {
      return res.status(400).json({ error: 'wallet must be a G... Stellar address' });
    }
    if (!['INSTAPAY', 'PESONET', 'EWALLET', 'BANK'].includes(rail)) {
      return res.status(400).json({ error: 'invalid rail' });
    }
    const profile = getLiquidityProfile();
    const txn = await createTxn({
      wallet,
      kind: 'withdraw',
      status: 'pending_user_transfer_start',
      network: profile.network,
      railProvider: profile.railProvider,
      railMode: profile.railMode,
      asset: 'native',
      amountIn: amountXlm,
      rail,
      destination,
      providerStatus: profile.railMode === 'mock' ? 'simulated_partner_quote' : 'operator_confirmed',
      message: `Awaiting XLM transfer for cashout to ${rail}`,
    });
    const dep = await getDepositAddress('XLM', txn.id);
    return res.status(200).json({
      id: txn.id,
      depositAddress: dep.address,
      memo: dep.memo,
      memoType: dep.memoType,
      amountXlm,
      rail,
      destination,
      beneficiaryName: beneficiaryName ?? 'PalengkePay Customer',
      status: txn.status,
      network: txn.network,
      railProvider: txn.railProvider,
      railMode: txn.railMode,
      spreadBps: txn.spreadBps,
    });
  }

  if (action === 'settle') {
    const { id, stellarTxHash } = (req.body ?? {}) as Record<string, string>;
    if (!id || !stellarTxHash) return res.status(400).json({ error: 'id and stellarTxHash required' });
    const txn = await getTxn(id);
    if (!txn) return res.status(404).json({ error: 'not found' });
    if (txn.kind !== 'withdraw') return res.status(400).json({ error: 'not a withdraw' });

    if (isAnchorConfigured()) {
      const check = await verifyIncomingPayment(stellarTxHash, id);
      if (!check.valid) {
        await updateTxn(id, { status: 'error', stellarTxHash, message: `verification failed: ${check.reason}` });
        return res.status(400).json({ error: 'horizon verification failed', reason: check.reason });
      }
      if (check.amountXlm && Number(check.amountXlm) + 0.0001 < Number(txn.amountIn)) {
        await updateTxn(id, { status: 'error', stellarTxHash, message: `underpaid: got ${check.amountXlm}, expected ${txn.amountIn}` });
        return res.status(400).json({ error: 'underpaid', got: check.amountXlm, expected: txn.amountIn });
      }
    }
    await updateTxn(id, { status: 'pending_anchor', stellarTxHash, message: 'Stellar transfer received, calculating payout' });

    const order = await placeOrder({ market: 'XLM-PHPT', side: 'SELL', type: 'MARKET', amount: txn.amountIn });
    const phpAmount = (Number(order.filledAmount) * Number(order.averagePrice)).toFixed(2);
    const profile = getLiquidityProfile();
    const feePhp = (Number(phpAmount) * (profile.feePercent / 100)).toFixed(2);
    await updateTxn(id, {
      pdaxOrderId: order.id,
      amountOut: phpAmount,
      feePhp,
      spreadBps: profile.spreadBps,
      rate: order.averagePrice,
      providerStatus: profile.railMode === 'mock' ? 'simulated_pdax_sell_filled' : 'partner_sell_filled',
      message: 'Awaiting operator to release PHP payout',
    });
    const receipt = await requestCashout({
      amountPhp: phpAmount,
      rail: (txn.rail ?? 'INSTAPAY') as 'INSTAPAY' | 'PESONET' | 'EWALLET' | 'BANK',
      destination: txn.destination ?? '',
      beneficiaryName: 'PalengkePay Customer',
    });
    await updateTxn(id, {
      pdaxCashoutId: receipt.id,
      externalTxId: receipt.reference,
      status: receipt.status === 'COMPLETED' ? 'completed' : 'pending_external',
      providerStatus: receipt.status,
      message: receipt.status === 'COMPLETED' ? 'PHP paid out' : 'Awaiting operator to mark PHP sent',
    });
    const final = await getTxn(id);
    return res.status(200).json({ id, status: final?.status, amountOut: final?.amountOut, reference: receipt.reference });
  }

  return res.status(400).json({ error: 'unknown action' });
}

// ── /api/ramp/cashin (PHP → XLM) ─────────────────────────────────────────────

async function cashin(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const action = (req.query.action as string | undefined) ?? 'quote';

  if (action === 'quote') {
    const { wallet, amountPhp } = (req.body ?? {}) as Record<string, string>;
    if (!wallet || !amountPhp) return res.status(400).json({ error: 'wallet, amountPhp required' });
    if (wallet.length !== 56 || !wallet.startsWith('G')) return res.status(400).json({ error: 'wallet must be a G... Stellar address' });

    const quote = await quoteCashin({ amountPhp, asset: 'XLM' });
    const quoteMeta = quoteWithLiquidityMetadata({
      id: `rmp_preview_${Date.now().toString(36)}`,
      amountPhp,
      assetAmount: quote.assetAmount,
      providerRate: quote.rate,
      nowMs: Date.now(),
    });
    const txn = await createTxn({
      wallet,
      kind: 'deposit',
      status: 'incomplete',
      network: getLiquidityProfile().network,
      railProvider: quoteMeta.railProvider,
      railMode: quoteMeta.railMode,
      asset: 'native',
      amountIn: amountPhp,
      amountOut: quote.assetAmount,
      amountFee: quoteMeta.feePhp,
      feePhp: quoteMeta.feePhp,
      spreadBps: quoteMeta.spreadBps,
      rate: quote.rate,
      providerStatus: quoteMeta.railMode === 'mock' ? 'simulated_quote_locked' : 'partner_quote_locked',
      message: `Quote valid until ${new Date(quoteMeta.expiresAt).toISOString()}`,
    });
    const finalQuote = quoteWithLiquidityMetadata({
      id: txn.id,
      amountPhp,
      assetAmount: quote.assetAmount,
      providerRate: quote.rate,
      nowMs: txn.startedAt,
    });
    await updateTxn(txn.id, {
      proofReference: finalQuote.proofReference,
      feePhp: finalQuote.feePhp,
      amountFee: finalQuote.feePhp,
      spreadBps: finalQuote.spreadBps,
    });
    return res.status(200).json({
      id: txn.id,
      amountPhp: finalQuote.amountPhp,
      amountXlm: finalQuote.amountXlm,
      rate: finalQuote.rate,
      feePhp: finalQuote.feePhp,
      spreadBps: finalQuote.spreadBps,
      railProvider: finalQuote.railProvider,
      railMode: finalQuote.railMode,
      proofReference: finalQuote.proofReference,
      expiresAt: finalQuote.expiresAt,
      instructions: { rail: 'GCash / QR Ph settlement rail', reference: finalQuote.proofReference },
    });
  }

  if (action === 'confirm') {
    const { id, reference, proofReference, operatorNote } = (req.body ?? {}) as Record<string, string>;
    if (!id) return res.status(400).json({ error: 'id required' });
    const txn = await getTxn(id);
    if (!txn) return res.status(404).json({ error: 'not found' });
    if (txn.kind !== 'deposit') return res.status(400).json({ error: 'not a deposit' });
    await updateTxn(id, {
      status: 'pending_external',
      externalTxId: reference ?? proofReference,
      proofReference: proofReference ?? reference ?? txn.proofReference,
      operatorNote,
      providerStatus: 'user_claimed_fiat_sent',
      message: 'PHP payment claimed, awaiting operator confirmation',
    });
    const final = await getTxn(id);
    return res.status(200).json({ id, status: final?.status });
  }

  return res.status(400).json({ error: 'unknown action' });
}

// ── /api/ramp/status ─────────────────────────────────────────────────────────

async function status(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  const id = req.query.id as string | undefined;
  const wallet = req.query.wallet as string | undefined;
  if (id) {
    const txn = await getTxn(id);
    if (!txn) return res.status(404).json({ error: 'not found' });
    return res.status(200).json({ transaction: txn });
  }
  if (wallet) {
    if (wallet.length !== 56 || !wallet.startsWith('G')) return res.status(400).json({ error: 'wallet must be G...' });
    const txns = await listForWallet(wallet);
    return res.status(200).json({ transactions: txns });
  }
  return res.status(400).json({ error: 'id or wallet required' });
}

// ── /api/ramp/admin (operator settlement) ────────────────────────────────────

async function admin(req: VercelRequest, res: VercelResponse) {
  if (!ADMIN_KEY) return res.status(500).json({ error: 'RAMP_ADMIN_KEY not configured' });
  if (!adminAuthorized(req)) return res.status(401).json({ error: 'unauthorized' });

  if (req.method === 'GET') {
    const txns = (await listPending()).filter((txn) => (txn.network ?? 'testnet') === getLiquidityProfile().network);
    return res.status(200).json({ transactions: txns });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const action = (req.query.action as string | undefined) ?? '';
  const { id, reason } = (req.body ?? {}) as Record<string, string>;
  if (!id) return res.status(400).json({ error: 'id required' });
  const txn = await getTxn(id);
  if (!txn) return res.status(404).json({ error: 'not found' });

  if (action === 'mark_php_sent') {
    if (txn.kind !== 'withdraw') return res.status(400).json({ error: 'not a withdraw' });
    const updated = await updateTxn(id, {
      status: 'completed',
      operatorNote: reason,
      providerStatus: 'operator_confirmed_fiat_sent',
      message: 'PHP sent — operator confirmed',
    });
    await fanout(txn.wallet, {
      title: 'PalengkePay — cashout complete',
      body: `PHP ${txn.amountOut ?? '—'} delivered to ${txn.rail}`,
      url: '/customer/profile',
    }).catch(() => null);
    return res.status(200).json({ ok: true, transaction: updated });
  }

  if (action === 'release_xlm') {
    if (txn.kind !== 'deposit') return res.status(400).json({ error: 'not a deposit' });
    const xlmAmount = txn.amountOut ?? '0';
    if (Number(xlmAmount) <= 0) return res.status(400).json({ error: 'no XLM amount on txn' });
    await updateTxn(id, { status: 'pending_stellar', message: 'Releasing XLM from anchor account' });
    const wd = await withdrawCrypto({ asset: 'XLM', amount: xlmAmount, address: txn.wallet, memo: id, memoType: 'TEXT' });
    const completed = String(wd.status).toUpperCase() === 'COMPLETED';
    const updated = await updateTxn(id, {
      pdaxWithdrawId: wd.id,
      stellarTxHash: completed ? wd.id : undefined,
      status: completed ? 'completed' : 'pending_stellar',
      providerStatus: String(wd.status),
      message: completed ? 'XLM delivered' : 'XLM withdrawal in flight',
    });
    await fanout(txn.wallet, {
      title: completed ? 'PalengkePay — XLM received' : 'PalengkePay — XLM in flight',
      body: completed ? `${xlmAmount} XLM in your wallet` : 'Your XLM is being sent',
      url: '/customer/profile',
    }).catch(() => null);
    return res.status(200).json({ ok: true, transaction: updated, stellarTxHash: completed ? wd.id : undefined });
  }

  if (action === 'fail') {
    const updated = await updateTxn(id, { status: 'error', message: `operator failed: ${reason ?? 'no reason given'}` });
    await fanout(txn.wallet, {
      title: 'PalengkePay — ramp failed',
      body: reason ?? 'Operator could not complete this transaction',
      url: '/customer/profile',
    }).catch(() => null);
    return res.status(200).json({ ok: true, transaction: updated });
  }

  return res.status(400).json({ error: 'unknown action' });
}
