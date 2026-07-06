import { FIAT_DECIMALS, fromNumber } from '@tonfolio/shared';
import { z } from 'zod';

import { JsonHttpClient, jsonNumber } from './http.js';

const simplePriceSchema = z.record(z.string(), z.record(z.string(), jsonNumber));

export interface FiatPrice {
  /** Fixed-point, FIAT_DECIMALS scale. */
  usd: bigint;
  uah: bigint;
}

export interface CoinGeckoClientOptions {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  retries?: number;
  backoffBaseMs?: number;
  fetchFn?: typeof fetch;
  sleepFn?: (ms: number) => Promise<void>;
}

export class CoinGeckoClient {
  private readonly http: JsonHttpClient;

  constructor(options: CoinGeckoClientOptions = {}) {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (options.apiKey) {
      headers['x-cg-demo-api-key'] = options.apiKey;
    }
    this.http = new JsonHttpClient({
      baseUrl: options.baseUrl ?? 'https://api.coingecko.com',
      headers,
      ...(options.timeoutMs !== undefined && { timeoutMs: options.timeoutMs }),
      ...(options.retries !== undefined && { retries: options.retries }),
      ...(options.backoffBaseMs !== undefined && { backoffBaseMs: options.backoffBaseMs }),
      ...(options.fetchFn !== undefined && { fetchFn: options.fetchFn }),
      ...(options.sleepFn !== undefined && { sleepFn: options.sleepFn }),
    });
  }

  /** One batched request for all ids; unknown ids are silently absent from the map. */
  async getPrices(ids: readonly string[]): Promise<Map<string, FiatPrice>> {
    const prices = new Map<string, FiatPrice>();
    if (ids.length === 0) return prices;

    const data = await this.http.get('/api/v3/simple/price', simplePriceSchema, {
      ids: ids.join(','),
      vs_currencies: 'usd,uah',
    });

    for (const id of ids) {
      const entry = data[id];
      if (!entry || entry.usd === undefined || entry.uah === undefined) continue;
      prices.set(id, {
        usd: fromNumber(entry.usd, FIAT_DECIMALS),
        uah: fromNumber(entry.uah, FIAT_DECIMALS),
      });
    }
    return prices;
  }
}
