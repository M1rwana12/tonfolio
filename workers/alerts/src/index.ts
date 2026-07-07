import { PriceService } from '@tonfolio/core';
import { getPrisma } from '@tonfolio/db';
import { CoinGeckoClient, TonApiClient } from '@tonfolio/ton';
import type { KeyValueStore } from '@tonfolio/ton';
import { PriceCache } from '@tonfolio/ton';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';

import { redisAlertLock } from './engine/locks.js';
import { telegramAlertSender } from './engine/notify.js';
import { runPriceAlertChecks, runTxAlertChecks } from './engine/run-checks.js';
import { loadEnv } from './env.js';
import { logger } from './logger.js';
import { pollPrices } from './jobs/poll-prices.js';
import { snapshotPortfolios } from './jobs/snapshot-portfolios.js';

const QUEUE_NAME = 'tonfolio-jobs';
const PRICE_POLL_INTERVAL_MS = 60_000;
const SNAPSHOT_INTERVAL_MS = 3_600_000;
const TX_CHECK_INTERVAL_MS = 120_000;

async function main(): Promise<void> {
  const env = loadEnv();
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const prisma = getPrisma();
  const tonapi = new TonApiClient(env.TONAPI_KEY ? { apiKey: env.TONAPI_KEY } : {});
  const coingecko = new CoinGeckoClient(
    env.COINGECKO_API_KEY ? { apiKey: env.COINGECKO_API_KEY } : {},
  );

  const redisStore: KeyValueStore = {
    get: (key) => connection.get(key),
    set: async (key, value, ttlSec) => {
      await connection.set(key, value, 'EX', ttlSec);
    },
  };
  const cache = new PriceCache(redisStore);
  const prices = new PriceService(prisma, coingecko);

  const engineDeps = {
    prisma,
    prices,
    tonapi,
    lock: redisAlertLock(connection),
    sender: telegramAlertSender(env.BOT_TOKEN),
  };

  const queue = new Queue(QUEUE_NAME, { connection });
  await queue.upsertJobScheduler(
    'poll-prices',
    { every: PRICE_POLL_INTERVAL_MS },
    { name: 'poll-prices' },
  );
  await queue.upsertJobScheduler(
    'snapshot-portfolios',
    { every: SNAPSHOT_INTERVAL_MS },
    { name: 'snapshot-portfolios' },
  );
  await queue.upsertJobScheduler(
    'check-tx-alerts',
    { every: TX_CHECK_INTERVAL_MS },
    { name: 'check-tx-alerts' },
  );

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      switch (job.name) {
        case 'poll-prices': {
          // price alerts are evaluated on every tick, right after the poll;
          // the check compares the pre-poll tick (baseline) with the live price
          const fired = await runPriceAlertChecks(engineDeps);
          const written = await pollPrices({ prisma, coingecko, cache });
          return { written, fired };
        }
        case 'snapshot-portfolios':
          return snapshotPortfolios({ prisma });
        case 'check-tx-alerts':
          return runTxAlertChecks(engineDeps);
        default:
          throw new Error(`unknown job: ${job.name}`);
      }
    },
    { connection },
  );

  worker.on('completed', (job, result) => {
    logger.info({ job: job.name, result }, 'job done');
  });
  worker.on('failed', (job, error) => {
    logger.error({ job: job?.name, err: error }, 'job failed');
  });

  const shutdown = async (): Promise<void> => {
    await worker.close();
    await queue.close();
    connection.disconnect();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  logger.info(
    {
      pricePollSec: PRICE_POLL_INTERVAL_MS / 1000,
      txCheckSec: TX_CHECK_INTERVAL_MS / 1000,
    },
    'worker started',
  );
}

main().catch((error: unknown) => {
  logger.error({ err: error }, 'fatal');
  process.exit(1);
});
