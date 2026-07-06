import { parse } from 'lossless-json';
import { z } from 'zod';
import type { ZodType } from 'zod';

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class RateLimitError extends HttpError {
  constructor(
    url: string,
    readonly retryAfterMs?: number,
  ) {
    super('rate limited (429)', 429, url);
    this.name = 'RateLimitError';
  }
}

export class NotFoundError extends HttpError {
  constructor(url: string) {
    super('not found (404)', 404, url);
    this.name = 'NotFoundError';
  }
}

export class TimeoutError extends Error {
  constructor(url: string, timeoutMs: number) {
    super(`request to ${url} timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

export class InvalidResponseError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'InvalidResponseError';
  }
}

/**
 * Integers arrive as bigint (exact — jetton amounts overflow doubles),
 * everything with a fraction or exponent as number.
 */
const parseJsonNumber = (value: string): unknown =>
  /^-?\d+$/.test(value) ? BigInt(value) : Number(value);

/** Accepts bigint/safe number/decimal string from lossless JSON, yields bigint. */
export const jsonBigint = z.preprocess((value) => {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  return value;
}, z.bigint());

/** Accepts bigint or number from lossless JSON, yields number. */
export const jsonNumber = z.preprocess(
  (value) => (typeof value === 'bigint' ? Number(value) : value),
  z.number(),
);

export interface JsonHttpClientOptions {
  baseUrl: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** Extra attempts after the first one. */
  retries?: number;
  backoffBaseMs?: number;
  fetchFn?: typeof fetch;
  sleepFn?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function isRetryable(error: unknown): boolean {
  if (error instanceof RateLimitError) return true;
  if (error instanceof NotFoundError) return false;
  if (error instanceof HttpError) return error.status >= 500;
  if (error instanceof TimeoutError) return true;
  if (error instanceof InvalidResponseError) return false;
  // fetch network failures (DNS, connection reset) surface as TypeError
  return error instanceof TypeError;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export class JsonHttpClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly backoffBaseMs: number;
  private readonly fetchFn: typeof fetch;
  private readonly sleepFn: (ms: number) => Promise<void>;

  constructor(options: JsonHttpClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.headers = options.headers ?? {};
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.retries = options.retries ?? 3;
    this.backoffBaseMs = options.backoffBaseMs ?? 500;
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
    this.sleepFn = options.sleepFn ?? defaultSleep;
  }

  async get<T>(path: string, schema: ZodType<T>, query?: Record<string, string>): Promise<T> {
    const url = new URL(this.baseUrl + path);
    for (const [key, value] of Object.entries(query ?? {})) {
      url.searchParams.set(key, value);
    }

    let attempt = 0;
    for (;;) {
      try {
        return await this.requestOnce(url.toString(), schema);
      } catch (error) {
        if (attempt >= this.retries || !isRetryable(error)) throw error;
        await this.sleepFn(this.delayFor(error, attempt));
        attempt += 1;
      }
    }
  }

  private delayFor(error: unknown, attempt: number): number {
    if (error instanceof RateLimitError && error.retryAfterMs !== undefined) {
      return error.retryAfterMs;
    }
    return this.backoffBaseMs * 2 ** attempt;
  }

  private async requestOnce<T>(url: string, schema: ZodType<T>): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      let response: Response;
      try {
        response = await this.fetchFn(url, { headers: this.headers, signal: controller.signal });
      } catch (error) {
        if (isAbortError(error)) throw new TimeoutError(url, this.timeoutMs);
        throw error;
      }

      if (response.status === 429) {
        const retryAfterSec = Number(response.headers.get('retry-after'));
        throw new RateLimitError(
          url,
          Number.isFinite(retryAfterSec) ? retryAfterSec * 1000 : undefined,
        );
      }
      if (response.status === 404) throw new NotFoundError(url);
      if (!response.ok)
        throw new HttpError(`HTTP ${response.status} from ${url}`, response.status, url);

      const text = await response.text();
      let data: unknown;
      try {
        data = parse(text, undefined, parseJsonNumber);
      } catch (error) {
        throw new InvalidResponseError(`malformed JSON from ${url}`, { cause: error });
      }
      const result = schema.safeParse(data);
      if (!result.success) {
        throw new InvalidResponseError(
          `unexpected response shape from ${url}: ${result.error.message}`,
        );
      }
      return result.data;
    } finally {
      clearTimeout(timer);
    }
  }
}
