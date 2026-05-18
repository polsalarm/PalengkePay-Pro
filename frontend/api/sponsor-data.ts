import type { VercelRequest, VercelResponse } from '@vercel/node';
import { TransactionBuilder, Networks, Keypair, Operation, Horizon } from '@stellar/stellar-sdk';

const HORIZON_URL = 'https://horizon-testnet.stellar.org';
const BASE_FEE = '100';
const KEY_OPEN = 'pp_open';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { vendor, isOpen } = (req.body ?? {}) as { vendor?: string; isOpen?: boolean };
  if (!vendor || typeof isOpen !== 'boolean') {
    return res.status(400).json({ error: 'vendor (G...) and isOpen (boolean) required' });
  }

  const sponsorSecret = process.env.SPONSOR_SECRET;
  if (!sponsorSecret) {
    return res.status(500).json({ error: 'Sponsor not configured' });
  }

  try {
    const sponsor = Keypair.fromSecret(sponsorSecret);
    const server = new Horizon.Server(HORIZON_URL);
    const vendorAccount = await server.loadAccount(vendor);
    const dataAttr = (vendorAccount.data_attr as Record<string, string> | undefined) ?? {};
    const alreadyExists = Boolean(dataAttr[KEY_OPEN]);
    const value = isOpen ? '1' : '0';

    const builder = new TransactionBuilder(vendorAccount, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    });

    if (!alreadyExists) {
      // First-time creation — sponsor the 0.5 XLM base reserve
      builder.addOperation(Operation.beginSponsoringFutureReserves({
        sponsoredId: vendor,
        source: sponsor.publicKey(),
      }));
      builder.addOperation(Operation.manageData({ name: KEY_OPEN, value }));
      builder.addOperation(Operation.endSponsoringFutureReserves({ source: vendor }));
    } else {
      // Existing entry — no new reserve. Plain update.
      builder.addOperation(Operation.manageData({ name: KEY_OPEN, value }));
    }

    const tx = builder.setTimeout(180).build();
    tx.sign(sponsor);
    return res.status(200).json({ innerXdr: tx.toXDR(), sponsored: !alreadyExists });
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message ?? 'Sponsor build failed' });
  }
}
