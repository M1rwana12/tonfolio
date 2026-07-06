import type { PrismaClient } from '@tonfolio/db';

import { computePortfolioTotals } from '../portfolio.js';

/** Values every user's portfolio at the latest known prices and stores a snapshot. */
export async function snapshotPortfolios({ prisma }: { prisma: PrismaClient }): Promise<number> {
  const users = await prisma.user.findMany({ include: { wallets: true } });

  const latestTicks = await prisma.priceTick.findMany({
    orderBy: { takenAt: 'desc' },
    distinct: ['assetId'],
  });
  const priceByAsset = new Map(
    latestTicks.map((tick) => [tick.assetId, { usd: tick.priceUsd, uah: tick.priceUah }]),
  );

  let snapshots = 0;
  for (const user of users) {
    const walletIds = user.wallets.map((wallet) => wallet.id);
    if (walletIds.length === 0) continue;

    const holdings = await prisma.holding.findMany({
      where: { walletId: { in: walletIds } },
      orderBy: { observedAt: 'desc' },
      distinct: ['walletId', 'assetId'],
      include: { asset: true },
    });

    const totals = computePortfolioTotals(
      holdings.map((holding) => ({
        amount: holding.amount,
        decimals: holding.asset.decimals,
        price: priceByAsset.get(holding.assetId) ?? null,
      })),
    );

    await prisma.portfolioSnapshot.create({ data: { userId: user.id, ...totals } });
    snapshots += 1;
  }
  return snapshots;
}
