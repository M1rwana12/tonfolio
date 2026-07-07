/**
 * Live demo of the alert engine without Redis/BullMQ: one evaluation cycle
 * against the real DB and live CoinGecko prices. Creates a crossing scenario
 * for TON (threshold between the latest stored tick and the live price),
 * runs the engine, prints the delivery and proves cooldown suppression on a
 * second run. Delivery goes to the real Telegram chat when the demo user has
 * started the bot; otherwise a console sender stands in.
 */
import { PriceService } from '@tonfolio/core';
import { getPrisma } from '@tonfolio/db';
import { FIAT_DECIMALS, formatUnits } from '@tonfolio/shared';
import { CoinGeckoClient, TonApiClient } from '@tonfolio/ton';

import { memoryAlertLock } from '../src/engine/locks.js';
import { telegramAlertSender } from '../src/engine/notify.js';
import type { AlertSender } from '../src/engine/notify.js';
import { runPriceAlertChecks } from '../src/engine/run-checks.js';
import { loadEnv } from '../src/env.js';

const DEMO_TG_ID = 700_000_001n;

async function main(): Promise<void> {
  const env = loadEnv();
  const prisma = getPrisma();
  const coingecko = new CoinGeckoClient(
    env.COINGECKO_API_KEY ? { apiKey: env.COINGECKO_API_KEY } : {},
  );
  const tonapi = new TonApiClient(env.TONAPI_KEY ? { apiKey: env.TONAPI_KEY } : {});
  const prices = new PriceService(prisma, coingecko);

  const ton = await prisma.asset.findFirst({ where: { symbol: 'TON', kind: 'NATIVE' } });
  if (!ton) throw new Error('TON asset missing — run db:seed');

  // pick a real user who talked to the bot; fall back to the seeded demo user
  const realUser = await prisma.user.findFirst({
    where: { telegramId: { not: DEMO_TG_ID } },
    orderBy: { createdAt: 'desc' },
  });
  const user =
    realUser ?? (await prisma.user.findUniqueOrThrow({ where: { telegramId: DEMO_TG_ID } }));
  console.log(`user: telegramId=${user.telegramId} (${realUser ? 'real chat' : 'seed user'})`);

  // live price + baseline tick → threshold strictly between them
  const live = (await prices.getCurrent([ton])).get(ton.id);
  if (!live) throw new Error('no live TON price');
  const baseline = live.usd - live.usd / 100n; // 1% below live
  await prisma.priceTick.create({
    data: {
      assetId: ton.id,
      priceUsd: baseline,
      priceUah: live.uah - live.uah / 100n,
      source: 'demo-baseline',
    },
  });
  const threshold = live.usd - live.usd / 200n; // 0.5% below live
  const fmt = (value: bigint): string => formatUnits(value, FIAT_DECIMALS, { maxFraction: 4 });
  console.log(
    `baseline tick: $${fmt(baseline)} → live: $${fmt(live.usd)}; alert threshold: $${fmt(threshold)}`,
  );

  const alert = await prisma.alert.create({
    data: {
      userId: user.id,
      type: 'PRICE_ABOVE',
      params: { type: 'PRICE_ABOVE', assetId: ton.id, priceUsd: threshold.toString() },
    },
  });

  const consoleSender: AlertSender = {
    send(telegramId, _locale, text, alertId) {
      console.log(`\n[DELIVERY → tg:${telegramId}] (alert ${alertId})\n${text}\n`);
      return Promise.resolve();
    },
  };
  const sender: AlertSender = realUser
    ? {
        async send(telegramId, locale, text, alertId) {
          await consoleSender.send(telegramId, locale, text, alertId);
          await telegramAlertSender(env.BOT_TOKEN).send(telegramId, locale, text, alertId);
          console.log('→ delivered to the real Telegram chat');
        },
      }
    : consoleSender;

  const deps = { prisma, prices, tonapi, lock: memoryAlertLock(), sender };

  console.log('\n— run #1 (crossing expected)');
  const fired = await runPriceAlertChecks(deps);
  console.log(`fired: ${fired}`);

  console.log('\n— run #2 (cooldown expected, no duplicate)');
  const firedAgain = await runPriceAlertChecks(deps);
  console.log(`fired: ${firedAgain}`);

  const events = await prisma.alertEvent.count({ where: { alertId: alert.id } });
  console.log(`\nAlertEvent rows for this alert: ${events}`);

  // cleanup demo artifacts
  await prisma.alert.delete({ where: { id: alert.id } });
  await prisma.priceTick.deleteMany({ where: { source: 'demo-baseline' } });
  await prisma.$disconnect();

  const ok = fired === 1 && firedAgain === 0 && events === 1;
  console.log(ok ? '\n✅ ALERT ENGINE DEMO PASSED' : '\n❌ ALERT ENGINE DEMO FAILED');
  process.exitCode = ok ? 0 : 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
