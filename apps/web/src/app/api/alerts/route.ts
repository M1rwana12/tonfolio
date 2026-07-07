import { MAX_ALERTS_PER_USER, alertParamsSchema } from '@tonfolio/shared';
import { z } from 'zod';

import { authenticate } from '@/lib/server/auth';
import { ApiError, apiRoute, json } from '@/lib/server/http';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { services } from '@/lib/server/services';

export const GET = apiRoute(async (req) => {
  const user = await authenticate(req);
  checkRateLimit(`alerts:${user.id}`, 60);
  const { prisma } = services();

  const [alerts, assets, wallets] = await Promise.all([
    prisma.alert.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } }),
    prisma.asset.findMany({
      where: { coingeckoId: { not: null } },
      orderBy: { symbol: 'asc' },
      select: { id: true, symbol: true, name: true },
    }),
    prisma.wallet.findMany({
      where: { userId: user.id },
      select: { id: true, addressFriendly: true, label: true },
    }),
  ]);

  return json({ alerts, assets, wallets });
});

const createSchema = z.object({ params: alertParamsSchema });

export const POST = apiRoute(async (req) => {
  const user = await authenticate(req);
  checkRateLimit(`alerts:${user.id}`, 20);
  const { prisma } = services();

  const body = createSchema.parse(await req.json());
  const params = body.params;

  const count = await prisma.alert.count({ where: { userId: user.id } });
  if (count >= MAX_ALERTS_PER_USER) {
    throw new ApiError(409, `alert limit reached (${MAX_ALERTS_PER_USER})`);
  }

  // referenced entities must exist and belong to the caller
  if ('assetId' in params && params.assetId !== undefined) {
    const asset = await prisma.asset.findUnique({ where: { id: params.assetId } });
    if (!asset) throw new ApiError(400, 'unknown asset');
  }
  if ('walletId' in params) {
    const wallet = await prisma.wallet.findFirst({
      where: { id: params.walletId, userId: user.id },
    });
    if (!wallet) throw new ApiError(400, 'unknown wallet');
  }

  const alert = await prisma.alert.create({
    data: { userId: user.id, type: params.type, params },
  });
  return json({ alert }, { status: 201 });
});
