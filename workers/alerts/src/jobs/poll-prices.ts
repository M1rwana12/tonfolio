import type { PrismaClient } from '@tonfolio/db';
import type { CoinGeckoClient, PriceCache } from '@tonfolio/ton';

export interface PollPricesDeps {
  prisma: PrismaClient;
  coingecko: CoinGeckoClient;
  cache: PriceCache;
}

/** One batched CoinGecko call → PriceTick rows + fresh cache entries. */
export async function pollPrices({ prisma, coingecko, cache }: PollPricesDeps): Promise<number> {
  const assets = await prisma.asset.findMany({ where: { coingeckoId: { not: null } } });
  const ids = assets.map((asset) => asset.coingeckoId).filter((id): id is string => id !== null);

  const prices = await coingecko.getPrices(ids);

  const ticks: Array<{ assetId: string; priceUsd: bigint; priceUah: bigint; source: string }> = [];
  for (const asset of assets) {
    const price = asset.coingeckoId ? prices.get(asset.coingeckoId) : undefined;
    if (!price) continue;
    ticks.push({
      assetId: asset.id,
      priceUsd: price.usd,
      priceUah: price.uah,
      source: 'coingecko',
    });
    await cache.set(asset.id, price);
  }
  if (ticks.length > 0) {
    await prisma.priceTick.createMany({ data: ticks });
  }
  return ticks.length;
}
