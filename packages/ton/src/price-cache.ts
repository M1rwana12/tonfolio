import { PRICE_CACHE_TTL_SEC } from '@tonfolio/shared';

import type { FiatPrice } from './coingecko.js';

/** Minimal key-value contract — Redis in production, an in-memory map in tests. */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSec: number): Promise<void>;
}

export class PriceCache {
  constructor(
    private readonly store: KeyValueStore,
    private readonly ttlSec: number = PRICE_CACHE_TTL_SEC,
  ) {}

  private key(assetId: string): string {
    return `price:${assetId}`;
  }

  async get(assetId: string): Promise<FiatPrice | null> {
    const raw = await this.store.get(this.key(assetId));
    if (raw === null) return null;
    try {
      const parsed = JSON.parse(raw) as { usd: string; uah: string };
      return { usd: BigInt(parsed.usd), uah: BigInt(parsed.uah) };
    } catch {
      // a corrupted entry is indistinguishable from a miss for callers
      return null;
    }
  }

  async set(assetId: string, price: FiatPrice): Promise<void> {
    const value = JSON.stringify({ usd: price.usd.toString(), uah: price.uah.toString() });
    await this.store.set(this.key(assetId), value, this.ttlSec);
  }
}
