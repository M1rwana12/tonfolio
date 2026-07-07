import { getPrisma } from '@tonfolio/db';
import { CoinGeckoClient, TonApiClient } from '@tonfolio/ton';

import { createBot } from './bot.js';
import type { BotDeps } from './context.js';
import { loadEnv } from './env.js';
import { PriceService } from './services/prices.js';

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

  await bot.start({
    drop_pending_updates: true,
    onStart: (me) => console.log(`[bot] @${me.username} is polling`),
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
