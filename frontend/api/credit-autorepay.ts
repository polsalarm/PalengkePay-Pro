import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  rpc, Contract, Account, TransactionBuilder, Keypair,
  Address, scValToNative, nativeToScVal,
} from '@stellar/stellar-sdk';
import { getRpcUrl, getNetworkPassphrase } from './_network.js';
import { isValidWallet } from './_pushValidation.js';
import {
  registerAutoRepayVendor, unregisterAutoRepayVendor, listAutoRepayVendors,
  type PoolAsset,
} from './_autoRepayStore.js';

/**
 * Credit-pool auto-repay: register worklist (POST) + cron relayer (GET), in
 * one file. Vercel Hobby plan caps Serverless Functions at 12 per deployment
 * (see ramp.ts) — these started as two separate files but had to be merged
 * back in to stay under the cap. GET/POST is a clean enough natural split
 * that no `_op` dispatch is needed here.
 *
 * POST — frontend calls this right after a vendor's `set_schedule` /
 * `cancel_schedule` tx confirms, so the cron relayer knows who to check.
 * Purely a worklist — the contract's own `next_due` gate is what actually
 * protects against early/duplicate collection, so a missed/failed call here
 * just means a vendor's auto-repay is silently skipped until re-registered.
 *
 * GET — periodic relayer (Vercel Cron, guarded by CRON_SECRET). `collect(vendor)`
 * is permissionless on-chain — it moves funds via the vendor's standing token
 * allowance, not this key's authority — so this only ever pays the tx fee. It
 * never custodies or authorizes vendor funds. Most calls are expected to
 * simulate-fail harmlessly ("not due yet", "no schedule set", "no outstanding
 * debt", allowance short) since the contract's own `next_due` gate — not this
 * cron's cadence — decides what's actually due. Those are skips, not errors.
 */

const CRON_SECRET = process.env.CRON_SECRET;
const SIM_SOURCE = 'GBI5W3JPFNGBMW2TCSGTNL3NPW6E423UN4BMAXAU34AXTSMTSDT2JDXH';

const POOL_IDS: Record<PoolAsset, string | undefined> = {
  USDC: process.env.VITE_CREDIT_POOL_USDC_CONTRACT_ID,
  XLM: process.env.VITE_CREDIT_POOL_XLM_CONTRACT_ID,
};

const REGISTRY_V2 = process.env.VITE_VENDOR_REGISTRY_V2_CONTRACT_ID;

interface CollectOutcome {
  vendor: string;
  asset: PoolAsset;
  result: 'collected' | 'skipped' | 'error';
  detail?: string;
}

async function debtOf(poolId: string, vendor: string): Promise<bigint | null> {
  const server = new rpc.Server(getRpcUrl());
  const contract = new Contract(poolId);
  const account = new Account(SIM_SOURCE, '0');
  const tx = new TransactionBuilder(account, { fee: '100', networkPassphrase: getNetworkPassphrase() })
    .addOperation(contract.call('debt', Address.fromString(vendor).toScVal()))
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) return null;
  return scValToNative(sim.result.retval) as bigint;
}

async function collectOne(asset: PoolAsset, poolId: string, vendor: string, sponsor: Keypair): Promise<CollectOutcome> {
  const server = new rpc.Server(getRpcUrl());
  const passphrase = getNetworkPassphrase();
  const contract = new Contract(poolId);
  const account = await server.getAccount(sponsor.publicKey());

  const tx = new TransactionBuilder(account, { fee: '100', networkPassphrase: passphrase })
    .addOperation(contract.call('collect', Address.fromString(vendor).toScVal()))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    const err = (sim as rpc.Api.SimulateTransactionErrorResponse).error;
    return { vendor, asset, result: 'skipped', detail: err };
  }

  const prepared = rpc.assembleTransaction(tx, sim).build();
  prepared.sign(sponsor);
  const sendResult = await server.sendTransaction(prepared);
  if (sendResult.status === 'ERROR') {
    return { vendor, asset, result: 'error', detail: 'send rejected' };
  }

  const hash = sendResult.hash;
  for (let attempts = 0; attempts < 15; attempts++) {
    await new Promise((r) => setTimeout(r, 2000));
    const getResult = await server.getTransaction(hash);
    if (getResult.status === 'SUCCESS') {
      const debt = await debtOf(poolId, vendor);
      if (debt === 0n) await unregisterAutoRepayVendor(asset, vendor);
      return { vendor, asset, result: 'collected' };
    }
    if (getResult.status === 'FAILED') return { vendor, asset, result: 'error', detail: 'failed on-chain' };
  }
  return { vendor, asset, result: 'error', detail: 'timed out waiting for confirmation' };
}

function parseId(raw: unknown): bigint | null {
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0) return BigInt(raw);
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return BigInt(raw);
  return null;
}

/**
 * Pulls a real, already-settled payment/installment into the vendor-registry
 * v2 credit score — record_activity_from_payment/_installment are
 * permissionless on-chain (no signature required), but *some* account still
 * has to pay the tx fee, so the sponsor key does that here. Frontend fires
 * this best-effort right after a real pay()/pay_installment() confirms (see
 * usePayment.ts / useUtang.ts) — a missed/failed call here just means that
 * one activity doesn't count toward the score yet; nothing is lost since
 * anyone can call the same registry fn again later (idempotent, deduped
 * on-chain by payment_id/utang_id). See CREDIT_SCORE_ORACLE_FIX.md.
 */
async function recordActivity(
  method: 'record_activity_from_payment' | 'record_activity_from_installment',
  id: bigint,
  sponsor: Keypair
): Promise<{ ok: boolean; detail?: string }> {
  if (!REGISTRY_V2) return { ok: false, detail: 'registry not configured' };

  const server = new rpc.Server(getRpcUrl());
  const passphrase = getNetworkPassphrase();
  const contract = new Contract(REGISTRY_V2);
  const account = await server.getAccount(sponsor.publicKey());

  const tx = new TransactionBuilder(account, { fee: '100', networkPassphrase: passphrase })
    .addOperation(contract.call(method, nativeToScVal(id, { type: 'u64' })))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    const err = (sim as rpc.Api.SimulateTransactionErrorResponse).error;
    return { ok: false, detail: err };
  }

  const prepared = rpc.assembleTransaction(tx, sim).build();
  prepared.sign(sponsor);
  const sendResult = await server.sendTransaction(prepared);
  if (sendResult.status === 'ERROR') return { ok: false, detail: 'send rejected' };

  const hash = sendResult.hash;
  for (let attempts = 0; attempts < 15; attempts++) {
    await new Promise((r) => setTimeout(r, 2000));
    const getResult = await server.getTransaction(hash);
    if (getResult.status === 'SUCCESS') return { ok: true };
    if (getResult.status === 'FAILED') return { ok: false, detail: 'failed on-chain' };
  }
  return { ok: false, detail: 'timed out waiting for confirmation' };
}

async function handleCollect(req: VercelRequest, res: VercelResponse) {
  const isProd = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  if (isProd && !CRON_SECRET) {
    return res.status(500).json({ error: 'CRON_SECRET not configured' });
  }
  if (CRON_SECRET && req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const sponsorSecret = process.env.SPONSOR_SECRET;
  if (!sponsorSecret) return res.status(500).json({ error: 'SPONSOR_SECRET not configured' });
  const sponsor = Keypair.fromSecret(sponsorSecret);

  const outcomes: CollectOutcome[] = [];
  for (const asset of ['USDC', 'XLM'] as PoolAsset[]) {
    const poolId = POOL_IDS[asset];
    if (!poolId) continue;

    let vendors: string[];
    try {
      vendors = await listAutoRepayVendors(asset);
    } catch {
      continue;
    }

    for (const vendor of vendors) {
      try {
        outcomes.push(await collectOne(asset, poolId, vendor, sponsor));
      } catch (err: unknown) {
        outcomes.push({ vendor, asset, result: 'error', detail: (err as Error).message });
      }
    }
  }

  return res.status(200).json({
    ok: true,
    collected: outcomes.filter((o) => o.result === 'collected').length,
    skipped: outcomes.filter((o) => o.result === 'skipped').length,
    errors: outcomes.filter((o) => o.result === 'error').length,
    outcomes,
  });
}

async function handleRegister(req: VercelRequest, res: VercelResponse) {
  const { vendor, asset, action, id } = (req.body ?? {}) as {
    vendor?: string;
    asset?: string;
    action?: string;
    id?: number | string;
  };

  if (action === 'record_payment' || action === 'record_installment') {
    const parsedId = parseId(id);
    if (parsedId === null) return res.status(400).json({ error: 'invalid id' });

    const sponsorSecret = process.env.SPONSOR_SECRET;
    if (!sponsorSecret) return res.status(500).json({ error: 'SPONSOR_SECRET not configured' });
    const sponsor = Keypair.fromSecret(sponsorSecret);

    const method = action === 'record_payment'
      ? 'record_activity_from_payment'
      : 'record_activity_from_installment';
    const result = await recordActivity(method, parsedId, sponsor);
    // Best-effort by design — 200 either way, frontend never blocks on this.
    return res.status(200).json(result);
  }

  if (!isValidWallet(vendor)) {
    return res.status(400).json({ error: 'invalid vendor address' });
  }
  if (asset !== 'USDC' && asset !== 'XLM') {
    return res.status(400).json({ error: 'asset must be USDC or XLM' });
  }
  if (action !== 'register' && action !== 'unregister') {
    return res.status(400).json({ error: 'action must be register or unregister' });
  }

  try {
    if (action === 'register') {
      await registerAutoRepayVendor(asset as PoolAsset, vendor);
    } else {
      await unregisterAutoRepayVendor(asset as PoolAsset, vendor);
    }
    return res.status(200).json({ ok: true });
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message ?? 'store write failed' });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') return handleCollect(req, res);
  if (req.method === 'POST') return handleRegister(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
}
