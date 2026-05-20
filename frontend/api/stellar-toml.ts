import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Keypair } from '@stellar/stellar-sdk';

/**
 * SEP-1 stellar.toml served dynamically so SIGNING_KEY is derived from
 * the deploy-time ANCHOR_SIGNING_SECRET env var.
 *
 * Rewrites in vercel.json map /.well-known/stellar.toml -> /api/stellar-toml.
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  const secret = process.env.ANCHOR_SIGNING_SECRET;
  let signingKey = '';
  if (secret) {
    try {
      signingKey = Keypair.fromSecret(secret).publicKey();
    } catch {
      signingKey = '';
    }
  }

  const network = process.env.ANCHOR_NETWORK_PASSPHRASE ?? 'Test SDF Network ; September 2015';
  const origin = process.env.ANCHOR_BASE_URL ?? `https://${req.headers.host ?? 'palengkepay-pro.vercel.app'}`;

  const lines = [
    'VERSION="0.1.0"',
    `NETWORK_PASSPHRASE="${network}"`,
    `WEB_AUTH_ENDPOINT="${origin}/api/sep10/auth"`,
    `TRANSFER_SERVER_SEP0024="${origin}/api/sep24"`,
    signingKey ? `SIGNING_KEY="${signingKey}"` : '',
    '',
    'ORG_NAME="PalengkePay"',
    'ORG_DESCRIPTION="Stellar payments for Filipino market vendors. SEP-24 anchor backed by PDAX."',
    `ORG_URL="${origin}"`,
    '',
    '[DOCUMENTATION]',
    'ORG_NAME="PalengkePay"',
    'ORG_DESCRIPTION="Stellar payments for Filipino market vendors. SEP-24 anchor backed by PDAX (PHP fiat rails)."',
    'ORG_OFFICIAL_EMAIL="hello@palengkepay.local"',
    '',
    '[[CURRENCIES]]',
    'code="native"',
    'status="live"',
    'is_asset_anchored=false',
    'desc="Stellar Lumens. PalengkePay anchor offers XLM <-> PHP on/off ramp via PDAX."',
  ].filter(Boolean).join('\n');

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).send(lines);
}
