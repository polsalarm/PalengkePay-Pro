import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  rpc, Contract, Account, TransactionBuilder, Networks,
  Address, nativeToScVal, scValToNative,
} from '@stellar/stellar-sdk';
import { listAllWallets } from '../_pushStore.js';
import { fanout } from '../_pushFanout.js';
import { isValidWallet } from '../_pushValidation.js';

/**
 * Daily cron — scans every subscribed wallet for active utangs, sends push
 * notifications for installments due within 24h or already overdue.
 *
 * Dedupe via tag `utang-due-<id>-<dayBucket>` so subsequent runs in the same
 * day don't re-notify (Web Push tags collapse on the device).
 */

const RPC_URL = process.env.VITE_SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org';
const ESCROW_ID = process.env.VITE_UTANG_ESCROW_CONTRACT_ID;
const SIM_SOURCE = 'GBI5W3JPFNGBMW2TCSGTNL3NPW6E423UN4BMAXAU34AXTSMTSDT2JDXH';
const CRON_SECRET = process.env.CRON_SECRET;

interface RawUtang {
  id: bigint;
  customer: string;
  vendor: string;
  total_amount: bigint;
  installment_amount: bigint;
  installments_total: number;
  installments_paid: number;
  next_due: bigint;
  status: { tag: string };
  description: string;
}

async function getCustomerUtangs(wallet: string): Promise<RawUtang[]> {
  if (!ESCROW_ID) return [];
  const server = new rpc.Server(RPC_URL);
  const contract = new Contract(ESCROW_ID);
  const account = new Account(SIM_SOURCE, '0');

  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(contract.call(
      'get_customer_utangs',
      Address.fromString(wallet).toScVal(),
      nativeToScVal(50, { type: 'u32' }),
      nativeToScVal(0, { type: 'u32' }),
    ))
    .setTimeout(30)
    .build();

  const result = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(result) || !result.result) return [];
  const decoded = scValToNative(result.result.retval);
  return Array.isArray(decoded) ? (decoded as RawUtang[]) : [];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel cron requests carry the Authorization header with the project's CRON_SECRET.
  const isProd = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  if (isProd && !CRON_SECRET) {
    return res.status(500).json({ error: 'CRON_SECRET not configured' });
  }
  if (CRON_SECRET && req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  if (!ESCROW_ID) {
    return res.status(500).json({ error: 'VITE_UTANG_ESCROW_CONTRACT_ID not set' });
  }

  const now = Math.floor(Date.now() / 1000);
  const horizon = now + 86400; // 24h ahead
  const dayBucket = Math.floor(now / 86400);

  let wallets: string[];
  try {
    wallets = await listAllWallets();
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as { message?: string }).message ?? 'store read failed' });
  }

  const stats = { walletsScanned: 0, utangsChecked: 0, notified: 0, errors: 0 };

  for (const wallet of wallets) {
    if (!isValidWallet(wallet)) {
      stats.errors++;
      continue;
    }
    stats.walletsScanned++;
    let utangs: RawUtang[];
    try {
      utangs = await getCustomerUtangs(wallet);
    } catch {
      stats.errors++;
      continue;
    }
    for (const u of utangs) {
      stats.utangsChecked++;
      if (u.status?.tag !== 'Active') continue;
      const due = Number(u.next_due);
      if (due > horizon) continue;
      const overdue = due < now;
      const daysDiff = Math.round((due - now) / 86400);
      const body = overdue
        ? `Overdue by ${Math.abs(daysDiff)}d · ${u.description}`
        : daysDiff <= 0
          ? `Due today · ${u.description}`
          : `Due in ${daysDiff}d · ${u.description}`;
      try {
        const result = await fanout(wallet, {
          title: overdue ? 'PalengkePay — utang overdue' : 'PalengkePay — utang paalala',
          body,
          tag: `utang-due-${u.id}-${dayBucket}`,
          url: '/customer/utang',
        });
        stats.notified += result.sent;
      } catch {
        stats.errors++;
      }
    }
  }

  return res.status(200).json({ ok: true, ...stats });
}
