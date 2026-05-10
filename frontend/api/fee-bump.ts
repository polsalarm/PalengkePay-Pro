import type { VercelRequest, VercelResponse } from '@vercel/node';
import { TransactionBuilder, Networks, Keypair, Transaction } from '@stellar/stellar-sdk';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { innerXdr } = (req.body ?? {}) as { innerXdr?: string };
  if (!innerXdr) return res.status(400).json({ error: 'innerXdr required' });

  const sponsorSecret = process.env.SPONSOR_SECRET;
  if (!sponsorSecret) return res.status(500).json({ error: 'Fee bump sponsor not configured' });

  try {
    const sponsorKeypair = Keypair.fromSecret(sponsorSecret);
    const innerTx = TransactionBuilder.fromXDR(innerXdr, Networks.TESTNET) as Transaction;

    const feeBump = TransactionBuilder.buildFeeBumpTransaction(
      sponsorKeypair,
      '10000',
      innerTx,
      Networks.TESTNET,
    );
    feeBump.sign(sponsorKeypair);

    return res.status(200).json({ feeBumpXdr: feeBump.toXDR() });
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message ?? 'Fee bump failed' });
  }
}
