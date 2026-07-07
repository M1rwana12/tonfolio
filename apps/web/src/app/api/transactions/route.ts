import { z } from 'zod';

import { authenticate } from '@/lib/server/auth';
import { ApiError, apiRoute, json } from '@/lib/server/http';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { services } from '@/lib/server/services';

const querySchema = z.object({
  walletId: z.string().min(1),
  beforeLt: z.string().regex(/^\d+$/).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const GET = apiRoute(async (req) => {
  const user = await authenticate(req);
  checkRateLimit(`transactions:${user.id}`, 30);
  const { prisma, tonapi } = services();

  const url = new URL(req.url);
  const query = querySchema.parse(Object.fromEntries(url.searchParams));

  const wallet = await prisma.wallet.findFirst({
    where: { id: query.walletId, userId: user.id },
  });
  if (!wallet) throw new ApiError(404, 'wallet not found');

  const items = await tonapi.getTransactions(wallet.addressFriendly, {
    limit: query.limit,
    ...(query.beforeLt !== undefined && { beforeLt: BigInt(query.beforeLt) }),
  });

  const last = items.at(-1);
  return json({
    items,
    nextBeforeLt: items.length === query.limit && last ? last.lt : null,
  });
});
