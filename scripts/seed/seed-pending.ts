/**
 * Seed pending vendor applications.
 *
 * Generates N real Stellar keypairs, funds them via Friendbot, and calls
 * apply_vendor on the VendorRegistry — but does NOT approve them. They show
 * up in the admin "Pending" tab so the admin can really click Approve/Decline
 * and sign on-chain via the wallet UI.
 *
 * Usage (PowerShell, from project root):
 *   $env:ADMIN_SECRET="S..."
 *   $env:REGISTRY_CONTRACT_ID="C..."
 *   npx tsx scripts/seed/seed-pending.ts
 *
 * Optional:
 *   $env:PENDING_COUNT="5"   # default 5
 *
 * Output: scripts/seed/seed-pending-output.json
 *   contains public + secret keys for each generated wallet — do NOT commit.
 */

import {
  Keypair, TransactionBuilder, Networks, rpc, Contract,
  Address, nativeToScVal, xdr as StellarXdr,
} from '@stellar/stellar-sdk';
import { writeFileSync } from 'fs';

// ── Config ────────────────────────────────────────────────────────────────────

const RPC_URL     = 'https://soroban-testnet.stellar.org';
const NETWORK     = Networks.TESTNET;
const EXPERT_BASE = 'https://stellar.expert/explorer/testnet';
const MARKET_ID   = 'marikina-public-market';

const REGISTRY_ID    = process.env.REGISTRY_CONTRACT_ID ?? '';
const PENDING_COUNT  = Number(process.env.PENDING_COUNT ?? '5');

if (!REGISTRY_ID) throw new Error('REGISTRY_CONTRACT_ID env var required');
if (!Number.isFinite(PENDING_COUNT) || PENDING_COUNT < 1) {
  throw new Error('PENDING_COUNT must be a positive integer');
}

const soroban = new rpc.Server(RPC_URL);

// ── Pending vendor demo data ──────────────────────────────────────────────────
// Different stall sections (E/F) so they don't collide with seed.ts (A–D).

const PENDING_PROFILES = [
  { name: 'Aling Marites Domingo', stall: 'E-1', product: 'fish',          phone: '0917-555-2201' },
  { name: 'Mang Onyok Pascual',    stall: 'E-3', product: 'meat',          phone: '0917-555-2202' },
  { name: 'Aling Susan Tolentino', stall: 'E-5', product: 'vegetables',    phone: '0917-555-2203' },
  { name: 'Manang Edna Lopez',     stall: 'F-2', product: 'fruits',        phone: '0917-555-2204' },
  { name: 'Mang Boy Salazar',      stall: 'F-4', product: 'rice & grains', phone: '0917-555-2205' },
  { name: 'Aling Tess Hernandez',  stall: 'F-6', product: 'spices',        phone: '0917-555-2206' },
  { name: 'Mang Jun Ocampo',       stall: 'F-7', product: 'fish',          phone: '0917-555-2207' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function log(msg: string) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

function expertTx(hash: string)      { return `${EXPERT_BASE}/tx/${hash}`; }
function expertAccount(addr: string) { return `${EXPERT_BASE}/account/${addr}`; }

async function friendbot(address: string, attempts = 4): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(`https://friendbot.stellar.org/?addr=${address}`, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) return;
      const text = await res.text().catch(() => '');
      if (text.includes('already') || text.includes('createAccountAlreadyExist')) return;
      log(`    Friendbot ${address.slice(0, 8)} attempt ${i + 1} failed: ${res.status}`);
    } catch {
      log(`    Friendbot ${address.slice(0, 8)} attempt ${i + 1} timeout — retrying…`);
    }
    await sleep(3000 * (i + 1));
  }
  throw new Error(`Friendbot gave up for ${address.slice(0, 8)}`);
}

async function prepareAndSign(
  signerKeypair: Keypair,
  contractId: string,
  method: string,
  args: StellarXdr.ScVal[],
): Promise<string> {
  const contract = new Contract(contractId);
  const account  = await soroban.getAccount(signerKeypair.publicKey());
  const tx = new TransactionBuilder(account, { fee: '1000000', networkPassphrase: NETWORK })
    .addOperation(contract.call(method, ...args))
    .setTimeout(300)
    .build();

  const sim = await soroban.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    const err = (sim as rpc.Api.SimulateTransactionErrorResponse).error;
    throw new Error(`Simulation failed (${method}): ${err}`);
  }

  const assembled = rpc.assembleTransaction(tx, sim).build();
  assembled.sign(signerKeypair);
  return assembled.toXDR();
}

async function submitSoroban(signedXdr: string): Promise<string> {
  const tx   = TransactionBuilder.fromXDR(signedXdr, NETWORK);
  const send = await soroban.sendTransaction(tx);
  if (send.status === 'ERROR') throw new Error(`Send failed: ${JSON.stringify(send)}`);

  const hash = send.hash;
  for (let i = 0; i < 20; i++) {
    await sleep(2000);
    const res = await soroban.getTransaction(hash);
    if (res.status === 'SUCCESS') return hash;
    if (res.status === 'FAILED')  throw new Error(`On-chain failure: ${hash}`);
  }
  throw new Error(`Timeout waiting for ${hash}`);
}

function addrScVal(addr: string) { return new Address(addr).toScVal(); }
function strScVal(s: string)     { return nativeToScVal(s, { type: 'string' }); }

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const profiles = PENDING_PROFILES.slice(0, PENDING_COUNT);
  log(`Registry: ${REGISTRY_ID.slice(0, 8)}…`);
  log(`Pending count: ${profiles.length}`);
  log('');

  const output: {
    pending: Array<{
      name: string; stall: string; product: string; phone: string;
      publicKey: string; secret: string;
      applyTxHash: string; expertUrl: string;
    }>;
  } = { pending: [] };

  // ── 1. Generate keypairs ──────────────────────────────────────────────────
  log('=== Generating keypairs ===');
  const keypairs = profiles.map(() => Keypair.random());
  profiles.forEach((p, i) => log(`  ${p.name.padEnd(28)} ${keypairs[i].publicKey()}`));

  // ── 2. Fund via Friendbot ─────────────────────────────────────────────────
  log('');
  log('=== Funding via Friendbot ===');
  for (let i = 0; i < keypairs.length; i += 5) {
    const batch = keypairs.slice(i, i + 5);
    await Promise.all(batch.map(async (kp, j) => {
      log(`  Fund pending ${i + j + 1}: ${kp.publicKey().slice(0, 8)}…`);
      await friendbot(kp.publicKey());
    }));
    await sleep(1000);
  }
  log('All accounts funded.');
  await sleep(3000); // let ledger settle

  // ── 3. apply_vendor (no approval — they stay pending) ─────────────────────
  log('');
  log('=== Applying as vendors (pending) ===');
  for (let i = 0; i < profiles.length; i++) {
    const p  = profiles[i];
    const kp = keypairs[i];
    log(`  Applying: ${p.name} (${p.stall})`);
    try {
      const xdr = await prepareAndSign(kp, REGISTRY_ID, 'apply_vendor', [
        addrScVal(kp.publicKey()),
        strScVal(MARKET_ID),
        strScVal(p.name),
        strScVal(p.stall),
        strScVal(p.phone),
        strScVal(p.product),
      ]);
      const hash = await submitSoroban(xdr);
      log(`    ✓ ${expertTx(hash)}`);

      output.pending.push({
        name: p.name,
        stall: p.stall,
        product: p.product,
        phone: p.phone,
        publicKey: kp.publicKey(),
        secret: kp.secret(),
        applyTxHash: hash,
        expertUrl: expertAccount(kp.publicKey()),
      });
    } catch (err) {
      log(`    ✗ ${(err as Error).message}`);
    }
    await sleep(1000);
  }

  // ── 4. Output ─────────────────────────────────────────────────────────────
  const outputPath = 'scripts/seed/seed-pending-output.json';
  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  log('');
  log('=== Done ===');
  log(`Pending applications: ${output.pending.length}`);
  log(`Output:               ${outputPath}  (contains secrets — never commit)`);
  log('');
  log('Open the admin dashboard → Pending tab to approve/decline these real applications on-chain.');
}

main().catch((err) => { console.error(err); process.exit(1); });
