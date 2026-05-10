/**
 * PalengkePay Testnet Seed Script
 *
 * Generates 15 vendor + 15 customer accounts, funds via Friendbot,
 * registers + approves vendors on-chain, then makes realistic demo payments.
 * All transactions visible on Stellar Expert testnet.
 *
 * Usage (run from frontend/ directory):
 *   ADMIN_SECRET=S... REGISTRY_CONTRACT_ID=C... npx tsx ../scripts/seed/seed.ts
 *
 * Output: ../scripts/seed/seed-output.json  (contains private keys — never commit)
 */

import {
  Keypair, TransactionBuilder, Networks, Operation, Asset, Memo,
  rpc, Contract, Account, Address, nativeToScVal, Horizon,
  xdr as StellarXdr,
} from '@stellar/stellar-sdk';
import { writeFileSync } from 'fs';

// ── Config ────────────────────────────────────────────────────────────────────

const HORIZON_URL   = 'https://horizon-testnet.stellar.org';
const RPC_URL       = 'https://soroban-testnet.stellar.org';
const NETWORK       = Networks.TESTNET;
const EXPERT_BASE   = 'https://stellar.expert/explorer/testnet';
const MARKET_ID     = 'marikina-public-market';

const ADMIN_SECRET          = process.env.ADMIN_SECRET ?? '';
const REGISTRY_CONTRACT_ID  = process.env.REGISTRY_CONTRACT_ID ?? '';

if (!ADMIN_SECRET)         throw new Error('ADMIN_SECRET env var required');
if (!REGISTRY_CONTRACT_ID) throw new Error('REGISTRY_CONTRACT_ID env var required');

const adminKeypair = Keypair.fromSecret(ADMIN_SECRET);
const horizon      = new Horizon.Server(HORIZON_URL);
const soroban      = new rpc.Server(RPC_URL);

// ── Demo data ─────────────────────────────────────────────────────────────────

const VENDOR_PROFILES = [
  { name: 'Aling Nena Reyes',       stall: 'A-2',  product: 'vegetables' },
  { name: 'Mang Rudy Dela Cruz',    stall: 'A-4',  product: 'fish' },
  { name: 'Aling Cora Santos',      stall: 'A-6',  product: 'meat' },
  { name: 'Manang Lily Bautista',   stall: 'A-7',  product: 'fruits' },
  { name: 'Aling Beth Garcia',      stall: 'B-1',  product: 'vegetables' },
  { name: 'Mang Tony Fernandez',    stall: 'B-3',  product: 'fish' },
  { name: 'Aling Rosa Gonzales',    stall: 'B-5',  product: 'rice & grains' },
  { name: 'Manang Perla Ramos',     stall: 'B-7',  product: 'spices' },
  { name: 'Aling Luisa Torres',     stall: 'C-2',  product: 'meat' },
  { name: 'Mang Eddie Flores',      stall: 'C-3',  product: 'fish' },
  { name: 'Aling Mila Castillo',    stall: 'C-5',  product: 'fruits' },
  { name: 'Manang Josie Rivera',    stall: 'C-6',  product: 'vegetables' },
  { name: 'Aling Linda Morales',    stall: 'D-1',  product: 'meat' },
  { name: 'Mang Ben Villanueva',    stall: 'D-2',  product: 'rice & grains' },
  { name: 'Aling Nora Aquino',      stall: 'D-4',  product: 'spices' },
];

const CUSTOMER_NAMES = [
  'Maria Clara Santos',   'Juan dela Cruz',      'Ana Reyes Lim',
  'Pedro Makabayan',      'Rosa Mendoza',        'Carlo Aguilar',
  'Luz Banaag',           'Jose Protacio R.',    'Elena Matapang',
  'Ramon Magsaysay Jr.',  'Cita Villafuerte',    'Bert Macapagal',
  'Nena Quirino',         'Alex Laurel',         'Gina Arroyo',
];

const PAYMENT_MEMOS = [
  'galunggong 2kg', 'kangkong at sitaw', 'baboy liempo',
  'mangga 3pcs', 'bigas 5kg', 'luya at bawang',
  'pechay at repolyo', 'tilapia 1kg', 'kamote tops',
  'itlog 1 dosena', 'ampalaya 2pcs', 'bayabas',
  'sibuyas at kamatis', 'bangus 2pcs', 'gabi at ube',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

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
      log(`    Friendbot ${address.slice(0,8)} attempt ${i+1} failed: ${res.status}`);
    } catch {
      log(`    Friendbot ${address.slice(0,8)} attempt ${i+1} timeout — retrying...`);
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
  const tx     = TransactionBuilder.fromXDR(signedXdr, NETWORK);
  const send   = await soroban.sendTransaction(tx);
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

async function sendPayment(
  from: Keypair,
  to: string,
  amount: string,
  memo: string,
): Promise<string> {
  const account    = await horizon.loadAccount(from.publicKey());
  const destExists = await horizon.loadAccount(to).then(() => true).catch(() => false);

  const builder = new TransactionBuilder(account, { fee: '10000', networkPassphrase: NETWORK });

  if (destExists) {
    builder.addOperation(Operation.payment({ destination: to, asset: Asset.native(), amount }));
  } else {
    builder.addOperation(Operation.createAccount({ destination: to, startingBalance: amount }));
  }

  builder.addMemo(Memo.text(memo.slice(0, 28)));
  const tx = builder.setTimeout(300).build();
  tx.sign(from);

  const result = await horizon.submitTransaction(tx);
  return result.hash as string;
}

function addrScVal(addr: string)    { return new Address(addr).toScVal(); }
function strScVal(s: string)        { return nativeToScVal(s, { type: 'string' }); }

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  log(`Admin: ${adminKeypair.publicKey().slice(0, 8)}...`);
  log(`Registry: ${REGISTRY_CONTRACT_ID.slice(0, 8)}...`);
  log('');

  const output: {
    vendors: Array<{ name: string; stall: string; product: string; publicKey: string; secret: string; expertUrl: string }>;
    customers: Array<{ name: string; publicKey: string; secret: string; expertUrl: string }>;
    payments: Array<{ from: string; to: string; amount: string; memo: string; txHash: string; expertUrl: string }>;
  } = { vendors: [], customers: [], payments: [] };

  // ── 1. Generate + fund all accounts in parallel ──────────────────────────
  log('=== Generating keypairs ===');
  const vendorKeypairs   = VENDOR_PROFILES.map(() => Keypair.random());
  const customerKeypairs = CUSTOMER_NAMES.map(() => Keypair.random());

  log('=== Funding via Friendbot (batches of 5) ===');
  const allKeypairs = [
    ...vendorKeypairs.map((kp, i) => ({ kp, label: `vendor ${i+1}` })),
    ...customerKeypairs.map((kp, i) => ({ kp, label: `customer ${i+1}` })),
  ];
  for (let i = 0; i < allKeypairs.length; i += 5) {
    const batch = allKeypairs.slice(i, i + 5);
    await Promise.all(batch.map(async ({ kp, label }) => {
      log(`  Fund ${label}: ${kp.publicKey().slice(0,8)}...`);
      await friendbot(kp.publicKey());
    }));
    await sleep(1000);
  }
  log('All accounts funded.');
  await sleep(3000); // let ledger settle

  // ── 2. Register vendors ───────────────────────────────────────────────────
  log('');
  log('=== Applying vendors to registry ===');
  for (let i = 0; i < VENDOR_PROFILES.length; i++) {
    const profile = VENDOR_PROFILES[i];
    const kp      = vendorKeypairs[i];
    log(`  Applying: ${profile.name} (${profile.stall})`);
    try {
      const xdr = await prepareAndSign(kp, REGISTRY_CONTRACT_ID, 'apply_vendor', [
        addrScVal(kp.publicKey()),
        strScVal(MARKET_ID),
        strScVal(profile.name),
        strScVal(profile.stall),
        strScVal(''),
        strScVal(profile.product),
      ]);
      const hash = await submitSoroban(xdr);
      log(`    ✓ ${expertTx(hash)}`);
    } catch (err) {
      log(`    ✗ ${(err as Error).message}`);
    }
    await sleep(1000);
  }

  // ── 3. Admin approves all vendors ─────────────────────────────────────────
  log('');
  log('=== Admin approving vendors ===');
  for (let i = 0; i < VENDOR_PROFILES.length; i++) {
    const profile = VENDOR_PROFILES[i];
    const vendorAddr = vendorKeypairs[i].publicKey();
    log(`  Approving: ${profile.name}`);
    try {
      const xdr = await prepareAndSign(adminKeypair, REGISTRY_CONTRACT_ID, 'approve_vendor', [
        addrScVal(adminKeypair.publicKey()),
        addrScVal(vendorAddr),
      ]);
      const hash = await submitSoroban(xdr);
      log(`    ✓ ${expertTx(hash)}`);

      output.vendors.push({
        name: profile.name,
        stall: profile.stall,
        product: profile.product,
        publicKey: vendorAddr,
        secret: vendorKeypairs[i].secret(),
        expertUrl: expertAccount(vendorAddr),
      });
    } catch (err) {
      log(`    ✗ ${(err as Error).message}`);
    }
    await sleep(1000);
  }

  // Record customers
  for (let i = 0; i < CUSTOMER_NAMES.length; i++) {
    output.customers.push({
      name: CUSTOMER_NAMES[i],
      publicKey: customerKeypairs[i].publicKey(),
      secret: customerKeypairs[i].secret(),
      expertUrl: expertAccount(customerKeypairs[i].publicKey()),
    });
  }

  // ── 4. Demo payments ──────────────────────────────────────────────────────
  log('');
  log('=== Making demo payments ===');

  // Each customer makes 2-3 random payments to random vendors
  for (let c = 0; c < customerKeypairs.length; c++) {
    const numPayments = 2 + (c % 2); // alternates 2 and 3
    for (let p = 0; p < numPayments; p++) {
      const vendorIdx = (c * 3 + p) % vendorKeypairs.length;
      const amount    = (50 + Math.floor(Math.random() * 450)).toString(); // 50-500 XLM
      const memo      = PAYMENT_MEMOS[(c + p) % PAYMENT_MEMOS.length];
      const from      = customerKeypairs[c];
      const to        = vendorKeypairs[vendorIdx].publicKey();

      log(`  ${CUSTOMER_NAMES[c]} → ${VENDOR_PROFILES[vendorIdx].name}: ${amount} XLM (${memo})`);
      try {
        const hash = await sendPayment(from, to, amount, memo);
        log(`    ✓ ${expertTx(hash)}`);
        output.payments.push({
          from: from.publicKey(),
          to,
          amount,
          memo,
          txHash: hash,
          expertUrl: expertTx(hash),
        });
      } catch (err) {
        log(`    ✗ ${(err as Error).message}`);
      }
      await sleep(500);
    }
  }

  // ── 5. Write output ───────────────────────────────────────────────────────
  const outputPath = '../scripts/seed/seed-output.json';
  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  log('');
  log(`=== Done ===`);
  log(`Vendors:  ${output.vendors.length}`);
  log(`Customers: ${output.customers.length}`);
  log(`Payments:  ${output.payments.length}`);
  log(`Output:    ${outputPath}  (contains secrets — never commit)`);
  log(`Explorer:  ${EXPERT_BASE}/account/${adminKeypair.publicKey()}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
