#!/usr/bin/env node
/**
 * One-shot setup for the PalengkePay SEP-24 anchor.
 *
 * Generates a Stellar testnet keypair, funds it via friendbot, prints the env
 * vars the operator should configure on Vercel.
 *
 * Usage:
 *   node scripts/setup-anchor.mjs
 *   node scripts/setup-anchor.mjs --fund-only G...   # fund an existing key
 */
import { Keypair } from '@stellar/stellar-sdk';

const args = process.argv.slice(2);
const FUND_ONLY_FLAG = '--fund-only';

async function friendbot(publicKey) {
  const res = await fetch(`https://friendbot.stellar.org/?addr=${publicKey}`);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`friendbot ${res.status}: ${text}`);
  }
  return res.json();
}

async function main() {
  if (args[0] === FUND_ONLY_FLAG) {
    const publicKey = args[1];
    if (!publicKey || publicKey.length !== 56 || !publicKey.startsWith('G')) {
      console.error('Usage: node scripts/setup-anchor.mjs --fund-only G...');
      process.exit(1);
    }
    console.log(`Funding ${publicKey} via friendbot…`);
    await friendbot(publicKey);
    console.log('Funded.');
    return;
  }

  const kp = Keypair.random();
  const publicKey = kp.publicKey();
  const secret = kp.secret();

  console.log('Generated PalengkePay anchor keypair:');
  console.log(`  Public:  ${publicKey}`);
  console.log(`  Secret:  ${secret}`);
  console.log('');
  console.log('Funding on testnet via friendbot…');
  await friendbot(publicKey);
  console.log('Funded with 10,000 XLM.');
  console.log('');
  console.log('Set these env vars in Vercel (production + preview + development):');
  console.log('');
  console.log(`  ANCHOR_SIGNING_SECRET=${secret}`);
  console.log('  ANCHOR_HOME_DOMAIN=palengkepay-pro.vercel.app');
  console.log('  ANCHOR_BASE_URL=https://palengkepay-pro.vercel.app');
  console.log('  ANCHOR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015');
  console.log('  ANCHOR_HORIZON_URL=https://horizon-testnet.stellar.org');
  console.log('  PDAX_MOCK=true');
  console.log(`  RAMP_ADMIN_KEY=${Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString('hex')}`);
  console.log('');
  console.log('Then redeploy. The SEP-24 anchor is live at:');
  console.log('  https://palengkepay-pro.vercel.app/.well-known/stellar.toml');
}

main().catch((err) => {
  console.error('Setup failed:', err.message ?? err);
  process.exit(1);
});
