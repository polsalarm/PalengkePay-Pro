import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const wallet = 'GBI5UQFUKSZYC7VKPUG7SCDQGZ3ZQV2KRPX73EP7SV73L5ZP5U4AGWPI';

function createRes() {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
    send(body: unknown) {
      this.body = body;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
  };
  return res as unknown as VercelResponse & typeof res;
}

describe('ramp admin API', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.RAMP_ADMIN_KEY = 'test-admin-key';
  });

  afterEach(() => {
    delete process.env.RAMP_ADMIN_KEY;
  });

  it('rejects export requests without the admin key', async () => {
    const { default: handler } = await import('./ramp.js');
    const res = createRes();

    await handler({
      method: 'GET',
      query: { _op: 'admin', scope: 'all', export: 'json' },
      headers: {},
    } as unknown as VercelRequest, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'unauthorized' });
  });

  it('returns active-network JSON exports for authorized operators', async () => {
    const [{ default: handler }, store] = await Promise.all([
      import('./ramp.js'),
      import('./_rampStore.js'),
    ]);
    store.resetRampStoreForTests();
    const testnet = await store.createTxn({
      wallet,
      kind: 'deposit',
      status: 'completed',
      asset: 'native',
      amountIn: '100.00',
      network: 'testnet',
    });
    const mainnet = await store.createTxn({
      wallet,
      kind: 'deposit',
      status: 'completed',
      asset: 'native',
      amountIn: '100.00',
      network: 'mainnet',
    });
    const res = createRes();

    await handler({
      method: 'GET',
      query: { _op: 'admin', scope: 'all', export: 'json' },
      headers: { 'x-admin-key': 'test-admin-key' },
    } as unknown as VercelRequest, res);

    expect(res.statusCode).toBe(200);
    expect((res.body as { transactions: Array<{ id: string }> }).transactions.map((txn) => txn.id)).toContain(testnet.id);
    expect((res.body as { transactions: Array<{ id: string }> }).transactions.map((txn) => txn.id)).not.toContain(mainnet.id);
  });

  it('returns CSV exports with the expected content type', async () => {
    const [{ default: handler }, store] = await Promise.all([
      import('./ramp.js'),
      import('./_rampStore.js'),
    ]);
    store.resetRampStoreForTests();
    await store.createTxn({
      wallet,
      kind: 'withdraw',
      status: 'pending_external',
      asset: 'native',
      amountIn: '5.0000000',
    });
    const res = createRes();

    await handler({
      method: 'GET',
      query: { _op: 'admin', scope: 'all', export: 'csv' },
      headers: { 'x-admin-key': 'test-admin-key' },
    } as unknown as VercelRequest, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toContain('text/csv');
    expect(res.body).toContain('id,network,kind,status,wallet');
  });

  it('appends demo seed records for authorized operators', async () => {
    const { default: handler } = await import('./ramp.js');
    const res = createRes();

    await handler({
      method: 'POST',
      query: { _op: 'admin', action: 'seed_demo' },
      headers: { 'x-admin-key': 'test-admin-key' },
      body: {},
    } as unknown as VercelRequest, res);

    expect(res.statusCode).toBe(200);
    expect((res.body as { transactions: unknown[] }).transactions).toHaveLength(4);
  });
});
