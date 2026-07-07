import { describe, expect, it } from 'vitest';

import { TonApiClient } from './tonapi.js';

function fakeFetch(responses: Array<{ status: number; body: string }>): {
  fetchFn: typeof fetch;
  requests: Array<{ url: string; headers: Headers }>;
} {
  const requests: Array<{ url: string; headers: Headers }> = [];
  const fetchFn: typeof fetch = (input, init) => {
    requests.push({ url: String(input), headers: new Headers(init?.headers) });
    const next = responses.shift();
    if (!next) throw new Error('fake fetch exhausted');
    return Promise.resolve(new Response(next.body, { status: next.status }));
  };
  return { fetchFn, requests };
}

const ADDRESS = 'UQCKPxxr0ulAdasRyfDeYnPItUwaL5DT6Lem9MXS4ZCDcs9O';

describe('TonApiClient', () => {
  it('fetches an account with bearer auth and bigint balance', async () => {
    const { fetchFn, requests } = fakeFetch([
      {
        status: 200,
        body: JSON.stringify({ address: '0:8a3f', balance: 987654321, status: 'active' }),
      },
    ]);
    const client = new TonApiClient({ apiKey: 'k', fetchFn, retries: 0 });

    const account = await client.getAccount(ADDRESS);

    expect(account).toEqual({ address: '0:8a3f', balance: 987_654_321n, status: 'active' });
    expect(requests[0]?.url).toBe(`https://tonapi.io/v2/accounts/${ADDRESS}`);
    expect(requests[0]?.headers.get('authorization')).toBe('Bearer k');
  });

  it('treats a 404 account as an empty uninitialized wallet', async () => {
    const { fetchFn } = fakeFetch([{ status: 404, body: '{"error":"entity not found"}' }]);
    const client = new TonApiClient({ fetchFn, retries: 0 });

    const account = await client.getAccount(ADDRESS);

    expect(account.balance).toBe(0n);
    expect(account.status).toBe('nonexist');
  });

  it('maps jetton balances with master, decimals and bigint amount', async () => {
    const { fetchFn } = fakeFetch([
      {
        status: 200,
        body: JSON.stringify({
          balances: [
            {
              balance: '2500000000000000',
              jetton: {
                address: '0:dogs',
                name: 'Dogs',
                symbol: 'DOGS',
                decimals: 9,
                verification: 'whitelist',
              },
            },
          ],
        }),
      },
    ]);
    const client = new TonApiClient({ fetchFn, retries: 0 });

    const balances = await client.getJettonBalances(ADDRESS);

    expect(balances).toEqual([
      {
        master: '0:dogs',
        name: 'Dogs',
        symbol: 'DOGS',
        decimals: 9,
        amount: 2_500_000_000_000_000n,
        verification: 'whitelist',
      },
    ]);
  });

  it('returns an empty list for a wallet without jettons', async () => {
    const { fetchFn } = fakeFetch([{ status: 200, body: '{"balances":[]}' }]);
    const client = new TonApiClient({ fetchFn, retries: 0 });

    await expect(client.getJettonBalances(ADDRESS)).resolves.toEqual([]);
  });

  it('fetches the account public key for ton_proof', async () => {
    const { fetchFn, requests } = fakeFetch([{ status: 200, body: '{"public_key":"aabbcc"}' }]);
    const client = new TonApiClient({ fetchFn, retries: 0 });

    await expect(client.getAccountPublicKey(ADDRESS)).resolves.toBe('aabbcc');
    expect(requests[0]?.url).toBe(`https://tonapi.io/v2/accounts/${ADDRESS}/publickey`);
  });

  it('paginates transactions older than a logical-time cursor', async () => {
    const { fetchFn, requests } = fakeFetch([{ status: 200, body: '{"transactions":[]}' }]);
    const client = new TonApiClient({ fetchFn, retries: 0 });

    await client.getTransactions(ADDRESS, { beforeLt: 123n, limit: 10 });

    const url = new URL(requests[0]?.url ?? '');
    expect(url.searchParams.get('before_lt')).toBe('123');
  });

  it('fetches transactions after a logical-time cursor', async () => {
    const { fetchFn, requests } = fakeFetch([
      {
        status: 200,
        body: JSON.stringify({
          transactions: [
            {
              hash: 'abc',
              lt: 47670502000002,
              utime: 1720000000,
              success: true,
              in_msg: { value: 1500000000 },
            },
          ],
        }),
      },
    ]);
    const client = new TonApiClient({ fetchFn, retries: 0 });

    const txs = await client.getTransactions(ADDRESS, { afterLt: 47670502000001n, limit: 20 });

    expect(txs).toEqual([
      {
        hash: 'abc',
        lt: 47_670_502_000_002n,
        utime: 1_720_000_000,
        success: true,
        valueIn: 1_500_000_000n,
      },
    ]);
    const url = new URL(requests[0]?.url ?? '');
    expect(url.pathname).toBe(`/v2/blockchain/accounts/${ADDRESS}/transactions`);
    expect(url.searchParams.get('after_lt')).toBe('47670502000001');
    expect(url.searchParams.get('limit')).toBe('20');
  });
});
