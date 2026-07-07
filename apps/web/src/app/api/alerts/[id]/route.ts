import { z } from 'zod';

import { authenticate } from '@/lib/server/auth';
import { ApiError, apiRoute, json } from '@/lib/server/http';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { services } from '@/lib/server/services';

const patchSchema = z.object({ status: z.enum(['ACTIVE', 'PAUSED']) });

export const PATCH = apiRoute(async (req, ctx) => {
  const user = await authenticate(req);
  checkRateLimit(`alerts:${user.id}`, 60);
  const { prisma } = services();
  const { id } = await ctx.params;
  if (!id) throw new ApiError(400, 'missing alert id');

  const body = patchSchema.parse(await req.json());
  const updated = await prisma.alert.updateMany({
    where: { id, userId: user.id },
    data: { status: body.status },
  });
  if (updated.count === 0) throw new ApiError(404, 'alert not found');

  const alert = await prisma.alert.findUnique({ where: { id } });
  return json({ alert });
});

export const DELETE = apiRoute(async (req, ctx) => {
  const user = await authenticate(req);
  checkRateLimit(`alerts:${user.id}`, 60);
  const { prisma } = services();
  const { id } = await ctx.params;
  if (!id) throw new ApiError(400, 'missing alert id');

  const deleted = await prisma.alert.deleteMany({ where: { id, userId: user.id } });
  if (deleted.count === 0) throw new ApiError(404, 'alert not found');
  return json({ ok: true });
});
