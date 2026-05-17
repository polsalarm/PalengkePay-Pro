import { afterEach, describe, expect, it } from 'vitest';
import { getSponsorRateLimitReadiness } from './health.js';

afterEach(() => {
  delete process.env.FEE_BUMP_REQUIRE_DURABLE_RATE_LIMIT;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.VERCEL_ENV;
});

describe('getSponsorRateLimitReadiness', () => {
  it('reports local memory fallback as non-production readiness only', () => {
    expect(getSponsorRateLimitReadiness()).toMatchObject({
      name: 'sponsor_rate_limit',
      ok: true,
      status: 200,
      detail: 'memory fallback for local development',
    });
  });

  it('fails production readiness when durable Redis REST env is missing', () => {
    process.env.VERCEL_ENV = 'production';

    expect(getSponsorRateLimitReadiness()).toMatchObject({
      name: 'sponsor_rate_limit',
      ok: false,
      status: 503,
      detail: 'durable Redis REST rate limiting is required',
    });
  });

  it('reports durable Redis REST readiness without exposing token values', () => {
    process.env.KV_REST_API_URL = 'https://redis.example';
    process.env.KV_REST_API_TOKEN = 'secret-token-value';

    const readiness = getSponsorRateLimitReadiness();

    expect(readiness).toMatchObject({
      name: 'sponsor_rate_limit',
      ok: true,
      status: 200,
      detail: 'durable Redis REST configured',
    });
    expect(JSON.stringify(readiness)).not.toContain('secret-token-value');
  });
});
