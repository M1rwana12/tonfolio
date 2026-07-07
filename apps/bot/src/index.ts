import { createServer } from 'node:http';

import { PriceService } from '@tonfolio/core';
import { getPrisma } from '@tonfolio/db';
import { CoinGeckoClient, TonApiClient } from '@tonfolio/ton';
import { webhookCallback } from 'grammy';

import { createBot } from './bot.js';
import type { BotDeps } from './context.js';
import { loadEnv } from './env.js';
import { logger } from './logger.js';

const WEBHOOK_PATH = '/api/bot';

async function main(): Promise<void> {
  const env = loadEnv();
  const prisma = getPrisma();
  const tonapi = new TonApiClient(env.TONAPI_KEY ? { apiKey: env.TONAPI_KEY } : {});
  const coingecko = new CoinGeckoClient(
    env.COINGECKO_API_KEY ? { apiKey: env.COINGECKO_API_KEY } : {},
  );
  const deps: BotDeps = { prisma, tonapi, prices: new PriceService(prisma, coingecko), env };

  const bot = createBot(deps);

  await bot.api.setMyCommands([
    { command: 'portfolio', description: 'Зведення портфеля' },
    { command: 'add_wallet', description: 'Додати гаманець' },
    { command: 'alerts', description: 'Алерти' },
    { command: 'language', description: 'Мова / Language' },
    { command: 'cancel', description: 'Скасувати діалог' },
  ]);
  await bot.api.setMyCommands(
    [
      { command: 'portfolio', description: 'Portfolio summary' },
      { command: 'add_wallet', description: 'Add a wallet' },
      { command: 'alerts', description: 'Alerts' },
      { command: 'language', description: 'Language' },
      { command: 'cancel', description: 'Cancel the dialog' },
    ],
    { language_code: 'en' },
  );

  if (env.BOT_MODE === 'webhook') {
    if (!env.APP_URL || !env.WEBHOOK_SECRET) {
      throw new Error('webhook mode requires APP_URL and WEBHOOK_SECRET');
    }
    await bot.init();
    const handleUpdate = webhookCallback(bot, 'http', { secretToken: env.WEBHOOK_SECRET });
    const server = createServer((req, res) => {
      if (req.method === 'POST' && req.url === WEBHOOK_PATH) {
        handleUpdate(req, res).catch((error: unknown) => {
          logger.error({ err: error }, 'webhook handler failed');
          if (!res.headersSent) res.writeHead(200);
          res.end();
        });
        return;
      }
      if (req.url === '/health') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{"status":"ok"}');
        return;
      }
      res.writeHead(404);
      res.end();
    });
    server.listen(env.PORT, () => {
      logger.info({ port: env.PORT }, 'webhook server listening');
    });
    await bot.api.setWebhook(`${env.APP_URL}${WEBHOOK_PATH}`, {
      secret_token: env.WEBHOOK_SECRET,
      drop_pending_updates: true,
    });
    logger.info({ url: `${env.APP_URL}${WEBHOOK_PATH}` }, 'webhook registered');
    return;
  }

  // dev: long polling (drops a previously registered webhook first)
  await bot.api.deleteWebhook({ drop_pending_updates: true });
  await bot.start({
    drop_pending_updates: true,
    onStart: (me) => logger.info(`@${me.username} is polling`),
  });
}

main().catch((error: unknown) => {
  logger.error({ err: error }, 'fatal');
  process.exit(1);
});
