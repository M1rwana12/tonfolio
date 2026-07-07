import { PriceService } from '@tonfolio/core';
import { getPrisma } from '@tonfolio/db';
import type { PrismaClient } from '@tonfolio/db';
import { CoinGeckoClient, TonApiClient } from '@tonfolio/ton';

import { serverEnv } from './env';

interface Services {
  prisma: PrismaClient;
  tonapi: TonApiClient;
  coingecko: CoinGeckoClient;
  prices: PriceService;
}

// survives Next.js dev-mode module reloads
const globalStore = globalThis as { __tonfolioServices?: Services };

export function services(): Services {
  if (!globalStore.__tonfolioServices) {
    const env = serverEnv();
    const prisma = getPrisma();
    const tonapi = new TonApiClient(env.TONAPI_KEY ? { apiKey: env.TONAPI_KEY } : {});
    const coingecko = new CoinGeckoClient(
      env.COINGECKO_API_KEY ? { apiKey: env.COINGECKO_API_KEY } : {},
    );
    globalStore.__tonfolioServices = {
      prisma,
      tonapi,
      coingecko,
      prices: new PriceService(prisma, coingecko),
    };
  }
  return globalStore.__tonfolioServices;
}
