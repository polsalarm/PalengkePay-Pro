import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getLiquidityProfile, getMainnetReadiness } from './liquidity-profile.js';

const liquidityProfile = getLiquidityProfile();
const HORIZON_URL = liquidityProfile.horizonUrl;
const RPC_URL = liquidityProfile.sorobanRpcUrl || 'https://soroban-testnet.stellar.org';

interface HealthCheck {
  name: string;
  ok: boolean;
  status: number;
  detail?: string;
}

function hasDurableRateLimitEnv(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return Boolean(url?.trim() && token?.trim());
}

function requiresDurableRateLimit(): boolean {
  return process.env.FEE_BUMP_REQUIRE_DURABLE_RATE_LIMIT === 'true'
    || process.env.VERCEL_ENV === 'production';
}

export function getSponsorRateLimitReadiness(): HealthCheck {
  if (hasDurableRateLimitEnv()) {
    return {
      name: 'sponsor_rate_limit',
      ok: true,
      status: 200,
      detail: 'durable Redis REST configured',
    };
  }

  if (requiresDurableRateLimit()) {
    return {
      name: 'sponsor_rate_limit',
      ok: false,
      status: 503,
      detail: 'durable Redis REST rate limiting is required',
    };
  }

  return {
    name: 'sponsor_rate_limit',
    ok: true,
    status: 200,
    detail: 'memory fallback for local development',
  };
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
  results.push(getSponsorRateLimitReadiness());
  results.push(getMainnetReadiness());

  const allOk = results.every((r) => r.ok);

  return res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    networkProfile: {
      profile: liquidityProfile.profile,
      network: liquidityProfile.network,
      railProvider: liquidityProfile.railProvider,
      railMode: liquidityProfile.railMode,
      liveFiatClaimsEnabled: liquidityProfile.liveFiatClaimsEnabled,
      warning: liquidityProfile.warning,
    },
    checks: results,
  });
}
