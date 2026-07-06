import { describe, expect, it } from 'vitest';

import { HttpError, InvalidResponseError, JsonHttpClient, TimeoutError } from './http.js';
import { z } from 'zod';

const schema = z.object({ ok: z.boolean() });

type FetchStep = { status: number; body?: string; headers?: Record<string, string> };

function fakeFetch(steps: FetchStep[]): { fetchFn: typeof fetch; calls: string[] } {
  const calls: string[] = [];
  const fetchFn: typeof fetch = (input) => {
    calls.push(String(input));
    const step = steps.shift();
    if (!step) throw new Error('fake fetch exhausted');
    return Promise.resolve(
      new Response(step.body ?? '{"ok":true}', { status: step.status, headers: step.headers }),
    );
  };
  return { fetchFn, calls };
}

function makeClient(fetchFn: typeof fetch, sleeps: number[]): JsonHttpClient {
  return new JsonHttpClient({
    baseUrl: 'https://api.example.test',
    fetchFn,
    sleepFn: (ms) => {
      sleeps.push(ms);
      return Promise.resolve();
    },
    retries: 2,
    backoffBaseMs: 500,
  });
}

describe('JsonHttpClient', () => {
  it('honors Retry-After on 429 and then succeeds', async () => {
    const sleeps: number[] = [];
    const { fetchFn, calls } = fakeFetch([
      { status: 429, headers: { 'retry-after': '2' } },
      { status: 200 },
    ]);
    const client = makeClient(fetchFn, sleeps);

    await expect(client.get('/x', schema)).resolves.toEqual({ ok: true });
    expect(calls).toHaveLength(2);
    expect(sleeps).toEqual([2000]);
  });

  it('retries 5xx with exponential backoff', async () => {
    const sleeps: number[] = [];
    const { fetchFn, calls } = fakeFetch([{ status: 502 }, { status: 503 }, { status: 200 }]);
    const client = makeClient(fetchFn, sleeps);

    await expect(client.get('/x', schema)).resolves.toEqual({ ok: true });
    expect(calls).toHaveLength(3);
    expect(sleeps).toEqual([500, 1000]);
  });

  it('throws HttpError with status after retries are exhausted', async () => {
    const { fetchFn, calls } = fakeFetch([{ status: 500 }, { status: 500 }, { status: 500 }]);
    const client = makeClient(fetchFn, []);

    await expect(client.get('/x', schema)).rejects.toMatchObject({ status: 500 });
    expect(calls).toHaveLength(3);
  });

  it('does not retry non-retryable 4xx', async () => {
    const { fetchFn, calls } = fakeFetch([{ status: 400, body: '{"error":"bad"}' }]);
    const client = makeClient(fetchFn, []);

    await expect(client.get('/x', schema)).rejects.toBeInstanceOf(HttpError);
    expect(calls).toHaveLength(1);
  });

  it('times out a hanging request', async () => {
    const hangingFetch: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        );
      });
    const client = new JsonHttpClient({
      baseUrl: 'https://api.example.test',
      fetchFn: hangingFetch,
      sleepFn: () => Promise.resolve(),
      retries: 0,
      timeoutMs: 20,
    });

    await expect(client.get('/x', schema)).rejects.toBeInstanceOf(TimeoutError);
  });

  it('rejects a response that fails schema validation without retrying', async () => {
    const { fetchFn, calls } = fakeFetch([{ status: 200, body: '{"nope":1}' }]);
    const client = makeClient(fetchFn, []);

    await expect(client.get('/x', schema)).rejects.toBeInstanceOf(InvalidResponseError);
    expect(calls).toHaveLength(1);
  });

  it('preserves integers beyond Number.MAX_SAFE_INTEGER as bigint', async () => {
    const big = z.object({ balance: z.bigint() });
    const { fetchFn } = fakeFetch([{ status: 200, body: '{"balance":9007199254740993}' }]);
    const client = makeClient(fetchFn, []);

    await expect(client.get('/x', big)).resolves.toEqual({ balance: 9_007_199_254_740_993n });
  });

  it('appends query parameters to the request URL', async () => {
    const { fetchFn, calls } = fakeFetch([{ status: 200 }]);
    const client = makeClient(fetchFn, []);

    await client.get('/tx', schema, { limit: '20', after_lt: '123' });
    expect(calls[0]).toBe('https://api.example.test/tx?limit=20&after_lt=123');
  });
});
