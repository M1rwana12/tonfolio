import { getPortfolioSummary } from '@tonfolio/core';
import { decimalToBigint } from '@tonfolio/db';

import { authenticate } from '@/lib/server/auth';
import { apiRoute, json } from '@/lib/server/http';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { services } from '@/lib/server/services';

const SNAPSHOT_DAYS = 30;

export const GET = apiRoute(async (req) => {
  const user = await authenticate(req);
  checkRateLimit(`portfolio:${user.id}`, 30);
  const { prisma, prices } = services();

  const [summary, wallets, snapshots] = await Promise.all([
    getPortfolioSummary({ prisma, prices }, user.id),
    prisma.wallet.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        addressFriendly: true,
        label: true,
        verified: true,
        isWatchOnly: true,
      },
    }),
    prisma.portfolioSnapshot.findMany({
      where: {
        userId: user.id,
        takenAt: { gte: new Date(Date.now() - SNAPSHOT_DAYS * 24 * 3600 * 1000) },
      },
      orderBy: { takenAt: 'asc' },
      select: { totalUsd: true, takenAt: true },
    }),
  ]);

  return json({
    locale: user.locale,
    summary,
    wallets,
    history: snapshots.map((snapshot) => ({
      t: snapshot.takenAt.getTime(),
      usd: decimalToBigint(snapshot.totalUsd),
    })),
  });
});
