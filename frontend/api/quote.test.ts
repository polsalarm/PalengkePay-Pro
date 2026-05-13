import { afterEach, describe, expect, it, vi } from 'vitest';
import { __resetStableCheckoutQuoteCacheForTests, getStableCheckoutRate } from './quote';

describe('getStableCheckoutRate', () => {
  afterEach(() => {
    __resetStableCheckoutQuoteCacheForTests();
    vi.unstubAllGlobals();
  });

  it('fetches and caches the PHP/XLM rate for the checkout window', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ stellar: { php: 8.75 } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const first = await getStableCheckoutRate(1_000);
    const second = await getStableCheckoutRate(2_000);

    expect(first).toEqual({ phpPerXlm: 8.75, fetchedAtMs: 1_000 });
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid provider rates', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ stellar: { php: 0 } }),
    }));

    await expect(getStableCheckoutRate(1_000)).rejects.toThrow('invalid rate');
  });
});
