import type { Asset, PrismaClient } from '@tonfolio/db';
import { decimalToBigint } from '@tonfolio/db';
import { bpsChange, valueInFiat } from '@tonfolio/shared';

import type { PriceService } from './prices.js';

export interface PortfolioPosition {
  assetId: string;
  symbol: string;
  name: string;
  amount: bigint;
  decimals: number;
  valueUsd: bigint;
  valueUah: bigint;
  change24Bps: bigint | null;
}

export interface PortfolioSummary {
  totalUsd: bigint;
  totalUah: bigint;
  change24Bps: bigint | null;
  positions: PortfolioPosition[];
}

export interface PortfolioDeps {
  prisma: PrismaClient;
  prices: PriceService;
}

/** Null when the user has no wallets at all. */
export async function getPortfolioSummary(
  deps: PortfolioDeps,
  userId: string,
): Promise<PortfolioSummary | null> {
  const wallets = await deps.prisma.wallet.findMany({
    where: { userId },
    select: { id: true },
  });
  if (wallets.length === 0) return null;

  const holdings = await deps.prisma.holding.findMany({
    where: { walletId: { in: wallets.map((wallet) => wallet.id) } },
    orderBy: { observedAt: 'desc' },
    distinct: ['walletId', 'assetId'],
    include: { asset: true },
  });

  const byAsset = new Map<string, { asset: Asset; amount: bigint }>();
  for (const holding of holdings) {
    const amount = decimalToBigint(holding.amount);
    const entry = byAsset.get(holding.assetId);
    if (entry) {
      entry.amount += amount;
    } else {
      byAsset.set(holding.assetId, { asset: holding.asset, amount });
    }
  }

  const assets = [...byAsset.values()].map((entry) => entry.asset);
  const current = await deps.prices.getCurrent(assets);
  const past = await deps.prices.get24hAgo(assets.map((asset) => asset.id));

  const positions: PortfolioPosition[] = [];
  let totalUsd = 0n;
  let totalUah = 0n;
  let totalPastUsd = 0n;
  let hasPast = false;

  for (const { asset, amount } of byAsset.values()) {
    if (amount <= 0n) continue;
    const price = current.get(asset.id);
    if (!price) continue;

    const valueUsd = valueInFiat(amount, asset.decimals, price.usd);
    const valueUah = valueInFiat(amount, asset.decimals, price.uah);
    const pastPrice = past.get(asset.id);
    if (pastPrice) {
      totalPastUsd += valueInFiat(amount, asset.decimals, pastPrice.usd);
      hasPast = true;
    }
    totalUsd += valueUsd;
    totalUah += valueUah;
    positions.push({
      assetId: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      amount,
      decimals: asset.decimals,
      valueUsd,
      valueUah,
      change24Bps: pastPrice ? bpsChange(pastPrice.usd, price.usd) : null,
    });
  }

  positions.sort((a, b) => (b.valueUsd > a.valueUsd ? 1 : b.valueUsd < a.valueUsd ? -1 : 0));

  return {
    totalUsd,
    totalUah,
    change24Bps: hasPast ? bpsChange(totalPastUsd, totalUsd) : null,
    positions,
  };
}
