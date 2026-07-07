import type { PriceService } from '@tonfolio/core';
import type { PrismaClient, User } from '@tonfolio/db';
import { FIAT_DECIMALS, alertParamsSchema, formatUnits } from '@tonfolio/shared';
import type { TonApiClient } from '@tonfolio/ton';

import { filterNewTransactions, prismaTxCacheRepo } from '../tx-dedup.js';
import { applyGuards, decidePriceAlert, minutesFromMidnight } from './decide.js';
import type { PriceAlertParams } from './decide.js';
import type { AlertLock } from './locks.js';
import type { AlertSender } from './notify.js';
import { buildPriceAlertMessage, buildTxAlertMessage } from './notify.js';

const PRICE_TYPES = ['PRICE_ABOVE', 'PRICE_BELOW', 'PRICE_CHANGE_PCT'] as const;
const TX_TYPES = ['WALLET_TX', 'LARGE_TRANSFER'] as const;
const TX_BOOTSTRAP_LIMIT = 5;

export interface EngineDeps {
  prisma: PrismaClient;
  prices: PriceService;
  tonapi: TonApiClient;
  lock: AlertLock;
  sender: AlertSender;
  now?: () => Date;
}

function quietOf(user: User, now: Date) {
  return {
    minutesNow: minutesFromMidnight(now, user.timezone),
    start: user.quietHoursStart,
    end: user.quietHoursEnd,
  };
}

async function fire(
  deps: EngineDeps,
  alert: { id: string; cooldownSec: number },
  user: User,
  text: string,
  payload: Record<string, string>,
): Promise<boolean> {
  // the lock TTL doubles as a distributed cooldown guard
  if (!(await deps.lock.acquire(`alert:${alert.id}`, alert.cooldownSec))) return false;
  const now = (deps.now ?? (() => new Date()))();
  await deps.sender.send(user.telegramId, user.locale, text, alert.id);
  await deps.prisma.alert.update({ where: { id: alert.id }, data: { lastFiredAt: now } });
  await deps.prisma.alertEvent.create({
    data: { alertId: alert.id, message: text, payload },
  });
  return true;
}

/** Runs after every price poll: evaluates all active price alerts. */
export async function runPriceAlertChecks(deps: EngineDeps): Promise<number> {
  const now = (deps.now ?? (() => new Date()))();
  const alerts = await deps.prisma.alert.findMany({
    where: { status: 'ACTIVE', type: { in: [...PRICE_TYPES] } },
    include: { user: true },
  });
  if (alerts.length === 0) return 0;

  const parsed = alerts.flatMap((alert) => {
    const result = alertParamsSchema.safeParse(alert.params);
    return result.success &&
      (result.data.type === 'PRICE_ABOVE' ||
        result.data.type === 'PRICE_BELOW' ||
        result.data.type === 'PRICE_CHANGE_PCT')
      ? [{ alert, params: result.data as PriceAlertParams }]
      : [];
  });

  const assetIds = [...new Set(parsed.map((entry) => entry.params.assetId))];
  const assets = await deps.prisma.asset.findMany({ where: { id: { in: assetIds } } });
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const current = await deps.prices.getCurrent(assets);

  // previous tick per asset — the crossing baseline
  const prevByAsset = new Map<string, bigint | null>();
  for (const assetId of assetIds) {
    const tick = await deps.prisma.priceTick.findFirst({
      where: { assetId },
      orderBy: { takenAt: 'desc' },
    });
    prevByAsset.set(assetId, tick ? tick.priceUsd : null);
  }

  let fired = 0;
  for (const { alert, params } of parsed) {
    const asset = assetById.get(params.assetId);
    const price = current.get(params.assetId);
    if (!asset || !price) continue;

    let windowStartPrice: bigint | null = null;
    if (params.type === 'PRICE_CHANGE_PCT') {
      const cutoff = new Date(now.getTime() - params.windowMinutes * 60 * 1000);
      const tick = await deps.prisma.priceTick.findFirst({
        where: { assetId: params.assetId, takenAt: { lte: cutoff } },
        orderBy: { takenAt: 'desc' },
      });
      windowStartPrice = tick ? tick.priceUsd : null;
    }

    const decision = decidePriceAlert({
      params,
      lastFiredAt: alert.lastFiredAt,
      cooldownSec: alert.cooldownSec,
      quiet: quietOf(alert.user, now),
      price: { prev: prevByAsset.get(params.assetId) ?? null, current: price.usd },
      windowStartPrice,
      now,
    });
    if (decision !== 'fire') continue;

    const kind =
      params.type === 'PRICE_ABOVE' ? 'above' : params.type === 'PRICE_BELOW' ? 'below' : 'change';
    const thresholdText =
      params.type === 'PRICE_CHANGE_PCT'
        ? `${params.thresholdBps / 100}%`
        : formatUnits(BigInt(params.priceUsd), FIAT_DECIMALS, { maxFraction: 4 });
    const text = buildPriceAlertMessage(
      alert.user.locale,
      asset.symbol,
      kind,
      thresholdText,
      price.usd,
    );

    if (await fire(deps, alert, alert.user, text, { priceUsd: price.usd.toString() })) {
      fired += 1;
    }
  }
  return fired;
}

/** Every ~2 minutes: new transactions of watched wallets, deduped via TxCache. */
export async function runTxAlertChecks(deps: EngineDeps): Promise<number> {
  const now = (deps.now ?? (() => new Date()))();
  const alerts = await deps.prisma.alert.findMany({
    where: { status: 'ACTIVE', type: { in: [...TX_TYPES] } },
    include: { user: true },
  });
  if (alerts.length === 0) return 0;

  const parsed = alerts.flatMap((alert) => {
    const result = alertParamsSchema.safeParse(alert.params);
    return result.success &&
      (result.data.type === 'WALLET_TX' || result.data.type === 'LARGE_TRANSFER')
      ? [{ alert, params: result.data }]
      : [];
  });

  const walletIds = [...new Set(parsed.map((entry) => entry.params.walletId))];
  const wallets = await deps.prisma.wallet.findMany({ where: { id: { in: walletIds } } });
  const repo = prismaTxCacheRepo(deps.prisma);

  let fired = 0;
  for (const wallet of wallets) {
    const cursor = await deps.prisma.txCache.findFirst({
      where: { walletId: wallet.id },
      orderBy: { lt: 'desc' },
    });
    const txs = await deps.tonapi.getTransactions(wallet.addressFriendly, {
      ...(cursor ? { afterLt: BigInt(cursor.lt.toString()) } : { limit: TX_BOOTSTRAP_LIMIT }),
    });
    const fresh = await filterNewTransactions(repo, wallet.id, txs);
    // first sync only fills the cache — otherwise every old tx would alert
    if (!cursor || fresh.length === 0) continue;

    for (const { alert, params } of parsed) {
      if (params.walletId !== wallet.id) continue;

      const matching =
        params.type === 'LARGE_TRANSFER'
          ? fresh.filter((tx) => tx.valueIn >= BigInt(params.minAmount))
          : fresh;
      if (matching.length === 0) continue;

      const guard = applyGuards({
        lastFiredAt: alert.lastFiredAt,
        cooldownSec: alert.cooldownSec,
        quiet: quietOf(alert.user, now),
        now,
      });
      if (guard !== 'fire') continue;

      const top = matching.reduce((a, b) => (a.valueIn >= b.valueIn ? a : b));
      const label =
        wallet.label ?? `${wallet.addressFriendly.slice(0, 4)}…${wallet.addressFriendly.slice(-4)}`;
      const text = buildTxAlertMessage(
        alert.user.locale,
        label,
        params.type === 'LARGE_TRANSFER' ? 'large' : 'tx',
        top.valueIn,
        top.hash,
      );
      if (await fire(deps, alert, alert.user, text, { txHash: top.hash, lt: top.lt.toString() })) {
        fired += 1;
      }
    }
  }
  return fired;
}
