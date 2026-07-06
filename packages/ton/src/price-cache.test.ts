import { describe, expect, it } from 'vitest';

import type { KeyValueStore } from './price-cache.js';
import { PriceCache } from './price-cache.js';

function memoryStore(): KeyValueStore & { ttls: Map<string, number> } {
  const data = new Map<string, string>();
  const ttls = new Map<string, number>();
  return {
    ttls,
    get: (key) => Promise.resolve(data.get(key) ?? null),
    set: (key, value, ttlSec) => {
      data.set(key, value);
      ttls.set(key, ttlSec);
      return Promise.resolve();
    },
  };
}

describe('PriceCache', () => {
  it('round-trips bigint prices through the store', async () => {
    const store = memoryStore();
    const cache = new PriceCache(store);

    await cache.set('asset-1', { usd: 5_420_000_000n, uah: 226_014_000_000n });

    await expect(cache.get('asset-1')).resolves.toEqual({
      usd: 5_420_000_000n,
      uah: 226_014_000_000n,
    });
  });

  it('returns null on a cache miss', async () => {
    const cache = new PriceCache(memoryStore());

    await expect(cache.get('unknown')).resolves.toBeNull();
  });

  it('writes entries with the configured TTL', async () => {
    const store = memoryStore();
    const cache = new PriceCache(store, 60);

    await cache.set('asset-1', { usd: 1n, uah: 41n });

    expect(store.ttls.get('price:asset-1')).toBe(60);
  });
});
