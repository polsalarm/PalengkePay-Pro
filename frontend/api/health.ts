import type { VercelRequest, VercelResponse } from '@vercel/node';

const HORIZON_URL = 'https://horizon-testnet.stellar.org';
const RPC_URL = process.env.SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const checks = await Promise.allSettled([
    fetch(`${HORIZON_URL}/`).then((r) => ({ name: 'horizon', ok: r.ok, status: r.status })),
    fetch(`${RPC_URL}/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth', params: [] }) })
      .then((r) => ({ name: 'soroban_rpc', ok: r.ok, status: r.status })),
  ]);

  const results = checks.map((c) =>
    c.status === 'fulfilled' ? c.value : { name: 'unknown', ok: false, status: 0 },
  );

  const allOk = results.every((r) => r.ok);

  return res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    checks: results,
  });
}
