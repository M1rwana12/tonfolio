import type { Asset, PrismaClient } from '@tonfolio/db';
import type { CoinGeckoClient, FiatPrice } from '@tonfolio/ton';

const CACHE_TTL_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Live prices with a short in-process cache; falls back to the latest
 * PriceTick rows when CoinGecko is unavailable.
 */
export class PriceService {
  private readonly cache = new Map<string, { price: FiatPrice; at: number }>();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly coingecko: CoinGeckoClient,
  ) {}

  async getCurrent(assets: readonly Asset[]): Promise<Map<string, FiatPrice>> {
    const result = new Map<string, FiatPrice>();
    const now = Date.now();
    const stale: Asset[] = [];

    for (const asset of assets) {
      const hit = this.cache.get(asset.id);
      if (hit && now - hit.at < CACHE_TTL_MS) {
        result.set(asset.id, hit.price);
      } else {
        stale.push(asset);
      }
    }

    const ids = stale.map((asset) => asset.coingeckoId).filter((id): id is string => id !== null);
    if (ids.length > 0) {
      try {
        const prices = await this.coingecko.getPrices(ids);
        for (const asset of stale) {
          const price = asset.coingeckoId ? prices.get(asset.coingeckoId) : undefined;
          if (!price) continue;
          this.cache.set(asset.id, { price, at: now });
          result.set(asset.id, price);
        }
      } catch (error) {
        console.warn('[prices] CoinGecko unavailable, falling back to DB ticks:', error);
      }
    }

    const unresolved = assets.filter((asset) => !result.has(asset.id)).map((asset) => asset.id);
    if (unresolved.length > 0) {
      const ticks = await this.prisma.priceTick.findMany({
        where: { assetId: { in: unresolved } },
        orderBy: { takenAt: 'desc' },
        distinct: ['assetId'],
      });
      for (const tick of ticks) {
        result.set(tick.assetId, { usd: tick.priceUsd, uah: tick.priceUah });
      }
    }
    return result;
  }

  async get24hAgo(assetIds: readonly string[]): Promise<Map<string, FiatPrice>> {
    const cutoff = new Date(Date.now() - DAY_MS);
    const result = new Map<string, FiatPrice>();
    for (const assetId of assetIds) {
      const tick = await this.prisma.priceTick.findFirst({
        where: { assetId, takenAt: { lte: cutoff } },
        orderBy: { takenAt: 'desc' },
      });
      if (tick) {
        result.set(assetId, { usd: tick.priceUsd, uah: tick.priceUah });
      }
    }
    return result;
  }
}
