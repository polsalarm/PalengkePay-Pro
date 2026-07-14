import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  rpc, Contract, Account, TransactionBuilder, Keypair,
  Address, scValToNative,
} from '@stellar/stellar-sdk';
import { getRpcUrl, getNetworkPassphrase } from '../_network.js';
import { listAutoRepayVendors, unregisterAutoRepayVendor, type PoolAsset } from '../_autoRepayStore.js';

/**
 * Periodic relayer for CreditPool scheduled auto-repay. `collect(vendor)` is
 * permissionless on-chain — it moves funds via the vendor's standing token
 * allowance, not this key's authority — so this cron only ever pays the tx
 * fee. It never custodies or authorizes vendor funds.
 *
 * Most calls are expected to simulate-fail harmlessly ("not due yet", "no
 * schedule set", "no outstanding debt", allowance short) since the contract's
 * own `next_due` gate — not this cron's cadence — decides what's actually due.
 * Those are skips, not errors.
 */

const CRON_SECRET = process.env.CRON_SECRET;
const SIM_SOURCE = 'GBI5W3JPFNGBMW2TCSGTNL3NPW6E423UN4BMAXAU34AXTSMTSDT2JDXH';

const POOL_IDS: Record<PoolAsset, string | undefined> = {
  USDC: process.env.VITE_CREDIT_POOL_USDC_CONTRACT_ID,
  XLM: process.env.VITE_CREDIT_POOL_XLM_CONTRACT_ID,
};

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
