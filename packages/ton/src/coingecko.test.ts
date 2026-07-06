import { describe, expect, it } from 'vitest';

import { CoinGeckoClient } from './coingecko.js';

function fakeFetch(body: string): {
  fetchFn: typeof fetch;
  requests: Array<{ url: string; headers: Headers }>;
} {
  const requests: Array<{ url: string; headers: Headers }> = [];
  const fetchFn: typeof fetch = (input, init) => {
    requests.push({ url: String(input), headers: new Headers(init?.headers) });
    return Promise.resolve(new Response(body, { status: 200 }));
  };
  return { fetchFn, requests };
}

describe('CoinGeckoClient', () => {
  it('batches ids in one request and returns fixed-point prices', async () => {
    const { fetchFn, requests } = fakeFetch(
      JSON.stringify({
        'the-open-network': { usd: 5.42, uah: 226.014 },
        notcoin: { usd: 0.00185, uah: 0.0771 },
        tether: { usd: 1, uah: 41.7 },
      }),
    );
    const client = new CoinGeckoClient({ apiKey: 'cg', fetchFn, retries: 0 });

    const prices = await client.getPrices(['the-open-network', 'notcoin', 'tether']);

    expect(prices.get('the-open-network')).toEqual({ usd: 5_420_000_000n, uah: 226_014_000_000n });
    expect(prices.get('notcoin')).toEqual({ usd: 1_850_000n, uah: 77_100_000n });
    expect(prices.get('tether')).toEqual({ usd: 1_000_000_000n, uah: 41_700_000_000n });

    const url = new URL(requests[0]?.url ?? '');
    expect(url.pathname).toBe('/api/v3/simple/price');
    expect(url.searchParams.get('ids')).toBe('the-open-network,notcoin,tether');
    expect(url.searchParams.get('vs_currencies')).toBe('usd,uah');
    expect(requests[0]?.headers.get('x-cg-demo-api-key')).toBe('cg');
  });

  it('skips ids missing from the response instead of failing', async () => {
    const { fetchFn } = fakeFetch(JSON.stringify({ tether: { usd: 1.0002, uah: 41.71 } }));
    const client = new CoinGeckoClient({ fetchFn, retries: 0 });

    const prices = await client.getPrices(['tether', 'unlisted-token']);

    expect(prices.size).toBe(1);
    expect(prices.has('unlisted-token')).toBe(false);
  });

  it('returns an empty map without a network call when no ids are given', async () => {
    const { fetchFn, requests } = fakeFetch('{}');
    const client = new CoinGeckoClient({ fetchFn, retries: 0 });

    await expect(client.getPrices([])).resolves.toEqual(new Map());
    expect(requests).toHaveLength(0);
  });
});
