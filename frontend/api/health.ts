import type { VercelRequest, VercelResponse } from '@vercel/node';

const HORIZON_URL = 'https://horizon-testnet.stellar.org';
const RPC_URL = process.env.SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org';

interface HealthCheck {
  name: string;
  ok: boolean;
  status: number;
  detail?: string;
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const checks = await Promise.allSettled<HealthCheck>([
    fetch(`${HORIZON_URL}/`).then((r) => ({ name: 'horizon', ok: r.ok, status: r.status })),
    fetch(`${RPC_URL}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth', params: {} }),
    }).then(async (r) => {
      const body = await r.json().catch(() => null) as {
        error?: { message?: string };
        result?: { status?: string };
      } | null;
      const rpcHealthy = body?.result?.status === 'healthy';
      return {
        name: 'soroban_rpc',
        ok: r.ok && rpcHealthy,
        status: r.status,
        detail: body?.error?.message ?? body?.result?.status,
      };
    }),
  ]);

  const results = checks.map((c) =>
    c.status === 'fulfilled' ? c.value : { name: 'unknown', ok: false, status: 0, detail: c.reason instanceof Error ? c.reason.message : 'check failed' },
  );

  const allOk = results.every((r) => r.ok);

  return res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    checks: results,
  });
}
