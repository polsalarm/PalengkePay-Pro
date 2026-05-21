import { beforeEach, describe, expect, it } from 'vitest';
import { createTxn, listAllForNetwork, listPending, listPendingForNetwork, resetRampStoreForTests, updateTxn } from './_rampStore.js';

const walletA = 'GA7QYNF7SOWQ3O6W4YMX57Z5T5B2NM4D7BPT57C6K2ZLGV27MNSYTEST';
const walletB = 'GB7QYNF7SOWQ3O6W4YMX57Z5T5B2NM4D7BPT57C6K2ZLGV27MNSYTEST';

describe('ramp store network metadata', () => {
  beforeEach(() => {
    resetRampStoreForTests();
  });

  it('defaults new ramp records to testnet with settlement event history', async () => {
    const txn = await createTxn({
      wallet: walletA,
      kind: 'deposit',
      status: 'incomplete',
      asset: 'native',
      amountIn: '100.00',
    });

    expect(txn.network).toBe('testnet');
    expect(txn.railProvider).toBe('PDAX_STYLE');
    expect(txn.railMode).toBe('mock');
    expect(txn.settlementEvents).toEqual([
      expect.objectContaining({
        status: 'incomplete',
        label: 'Ramp created',
      }),
    ]);
  });

  it('keeps pending queues separated by Stellar network', async () => {
    const testnet = await createTxn({
      wallet: walletA,
      kind: 'withdraw',
      status: 'pending_external',
      asset: 'native',
      amountIn: '5.0000000',
      network: 'testnet',
    });
    const mainnet = await createTxn({
      wallet: walletB,
      kind: 'withdraw',
      status: 'pending_external',
      asset: 'native',
      amountIn: '5.0000000',
      network: 'mainnet',
    });

    const allPending = await listPending();
    const testnetPending = await listPendingForNetwork('testnet');
    const mainnetPending = await listPendingForNetwork('mainnet');

    expect(allPending.map((t) => t.id)).toEqual(expect.arrayContaining([testnet.id, mainnet.id]));
    expect(testnetPending.map((t) => t.id)).toContain(testnet.id);
    expect(testnetPending.map((t) => t.id)).not.toContain(mainnet.id);
    expect(mainnetPending.map((t) => t.id)).toContain(mainnet.id);
    expect(mainnetPending.map((t) => t.id)).not.toContain(testnet.id);
  });

  it('keeps an all-record index separated by Stellar network', async () => {
    const completed = await createTxn({
      wallet: walletA,
      kind: 'withdraw',
      status: 'completed',
      asset: 'native',
      amountIn: '5.0000000',
      network: 'testnet',
    });
    const failedMainnet = await createTxn({
      wallet: walletB,
      kind: 'deposit',
      status: 'error',
      asset: 'native',
      amountIn: '100.00',
      network: 'mainnet',
    });

    expect((await listPending()).map((t) => t.id)).not.toContain(completed.id);
    expect((await listAllForNetwork('testnet')).map((t) => t.id)).toContain(completed.id);
    expect((await listAllForNetwork('testnet')).map((t) => t.id)).not.toContain(failedMainnet.id);
    expect((await listAllForNetwork('mainnet')).map((t) => t.id)).toContain(failedMainnet.id);
  });


  it('appends settlement events when ramp status changes', async () => {
    const txn = await createTxn({
      wallet: walletA,
      kind: 'deposit',
      status: 'pending_external',
      asset: 'native',
      amountIn: '50.00',
      message: 'Waiting for GCash / QR Ph settlement rail',
    });

    const updated = await updateTxn(txn.id, {
      status: 'completed',
      operatorNote: 'Reference confirmed in demo console',
      externalTxId: 'GCASH-123456',
      message: 'PHP proof accepted',
    });

    expect(updated?.settlementEvents?.at(-1)).toMatchObject({
      status: 'completed',
      label: 'Completed',
      operatorNote: 'Reference confirmed in demo console',
      externalTxId: 'GCASH-123456',
    });
  });
});
