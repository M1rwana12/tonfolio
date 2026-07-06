import { getPrisma } from '@tonfolio/db';
import { CoinGeckoClient, PriceCache } from '@tonfolio/ton';
import type { KeyValueStore } from '@tonfolio/ton';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';

import { loadEnv } from './env.js';
import { pollPrices } from './jobs/poll-prices.js';
import { snapshotPortfolios } from './jobs/snapshot-portfolios.js';

const QUEUE_NAME = 'tonfolio-jobs';
const PRICE_POLL_INTERVAL_MS = 60_000;
const SNAPSHOT_INTERVAL_MS = 3_600_000;

async function main(): Promise<void> {
  const env = loadEnv();
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const prisma = getPrisma();

  const redisStore: KeyValueStore = {
    get: (key) => connection.get(key),
    set: async (key, value, ttlSec) => {
      await connection.set(key, value, 'EX', ttlSec);
    },
  };

  const coingecko = new CoinGeckoClient(
    env.COINGECKO_API_KEY ? { apiKey: env.COINGECKO_API_KEY } : {},
  );
  const cache = new PriceCache(redisStore);

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

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      switch (job.name) {
        case 'poll-prices':
          return pollPrices({ prisma, coingecko, cache });
        case 'snapshot-portfolios':
          return snapshotPortfolios({ prisma });
        default:
          throw new Error(`unknown job: ${job.name}`);
      }
    },
    { connection },
  );

  worker.on('completed', (job, result) => {
    console.log(`[worker] ${job.name}: done (${JSON.stringify(result)})`);
  });
  worker.on('failed', (job, error) => {
    console.error(`[worker] ${job?.name ?? 'unknown'}: failed — ${error.message}`);
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

  console.log(
    `[worker] started: poll-prices every ${PRICE_POLL_INTERVAL_MS / 1000}s, ` +
      `snapshot-portfolios every ${SNAPSHOT_INTERVAL_MS / 60000}min`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
