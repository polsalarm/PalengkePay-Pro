import { beforeEach, describe, expect, it } from 'vitest';
import { createTxn, listAllForNetwork, resetRampStoreForTests } from './_rampStore.js';
import { rampTxnsToCsv, seedDemoRampData } from './ramp.js';

const wallet = 'GBI5UQFUKSZYC7VKPUG7SCDQGZ3ZQV2KRPX73EP7SV73L5ZP5U4AGWPI';

describe('ramp admin export helpers', () => {
  beforeEach(() => {
    resetRampStoreForTests();
  });

  it('escapes CSV fields for operator audit export', async () => {
    const txn = await createTxn({
      wallet,
      kind: 'withdraw',
      status: 'completed',
      asset: 'native',
      amountIn: '5.0000000',
      destination: 'GCash, 0917 "Demo"',
      operatorNote: 'Operator said "paid"',
    });

    const csv = rampTxnsToCsv([txn]);

    expect(csv.split('\n')[0]).toContain('id,network,kind,status,wallet');
    expect(csv).toContain('"GCash, 0917 ""Demo"""');
    expect(csv).toContain('"Operator said ""paid"""');
  });

  it('seed demo appends records without deleting existing records', async () => {
    const existing = await createTxn({
      wallet,
      kind: 'deposit',
      status: 'pending_external',
      asset: 'native',
      amountIn: '100.00',
    });

    const seeded = await seedDemoRampData();
    const all = await listAllForNetwork('testnet');

    expect(seeded).toHaveLength(4);
    expect(all.map((txn) => txn.id)).toContain(existing.id);
    expect(all).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'deposit', status: 'pending_external' }),
      expect.objectContaining({ kind: 'withdraw', status: 'pending_external' }),
      expect.objectContaining({ kind: 'withdraw', status: 'completed' }),
      expect.objectContaining({ kind: 'deposit', status: 'error' }),
    ]));
  });
});
