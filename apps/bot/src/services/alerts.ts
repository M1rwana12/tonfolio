import type { Alert, AlertStatus, PrismaClient } from '@tonfolio/db';
import {
  FIAT_DECIMALS,
  MAX_ALERTS_PER_USER,
  alertParamsSchema,
  formatUnits,
} from '@tonfolio/shared';

export interface AlertView {
  id: string;
  status: AlertStatus;
  label: string;
}

export async function listAlertViews(prisma: PrismaClient, userId: string): Promise<AlertView[]> {
  const alerts = await prisma.alert.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  if (alerts.length === 0) return [];

  const assets = await prisma.asset.findMany({ select: { id: true, symbol: true } });
  const symbolById = new Map(assets.map((asset) => [asset.id, asset.symbol]));

  return alerts.map((alert) => {
    let label: string = alert.type;
    const parsed = alertParamsSchema.safeParse(alert.params);
    if (parsed.success) {
      const params = parsed.data;
      if (params.type === 'PRICE_ABOVE' || params.type === 'PRICE_BELOW') {
        const symbol = symbolById.get(params.assetId) ?? '?';
        const price = formatUnits(BigInt(params.priceUsd), FIAT_DECIMALS, { maxFraction: 4 });
        label = `${symbol} ${params.type === 'PRICE_ABOVE' ? '≥' : '≤'} $${price}`;
      }
    }
    return { id: alert.id, status: alert.status, label };
  });
}

export type CreatePriceAlertResult = { ok: true; alert: Alert } | { ok: false; reason: 'limit' };

export async function createPriceAlert(
  prisma: PrismaClient,
  userId: string,
  input: { assetId: string; direction: 'above' | 'below'; priceUsd: bigint },
): Promise<CreatePriceAlertResult> {
  const count = await prisma.alert.count({ where: { userId } });
  if (count >= MAX_ALERTS_PER_USER) return { ok: false, reason: 'limit' };

  const params = alertParamsSchema.parse({
    type: input.direction === 'above' ? 'PRICE_ABOVE' : 'PRICE_BELOW',
    assetId: input.assetId,
    priceUsd: input.priceUsd.toString(),
  });
  const alert = await prisma.alert.create({
    data: { userId, type: params.type, params },
  });
  return { ok: true, alert };
}

/** Ownership-checked status flip; returns false when the alert is not the user's. */
export async function setAlertStatus(
  prisma: PrismaClient,
  userId: string,
  alertId: string,
  status: AlertStatus,
): Promise<boolean> {
  const updated = await prisma.alert.updateMany({
    where: { id: alertId, userId },
    data: { status },
  });
  return updated.count > 0;
}

export async function deleteAlert(
  prisma: PrismaClient,
  userId: string,
  alertId: string,
): Promise<boolean> {
  const deleted = await prisma.alert.deleteMany({ where: { id: alertId, userId } });
  return deleted.count > 0;
}
