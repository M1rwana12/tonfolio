import { z } from 'zod';

import { JsonHttpClient, NotFoundError, jsonBigint, jsonNumber } from './http.js';

const accountSchema = z.object({
  address: z.string(),
  balance: jsonBigint,
  status: z.string(),
});

const jettonBalancesSchema = z.object({
  balances: z.array(
    z.object({
      balance: jsonBigint,
      jetton: z.object({
        address: z.string(),
        name: z.string(),
        symbol: z.string(),
        decimals: jsonNumber,
        verification: z.string().optional(),
      }),
    }),
  ),
});

const publicKeySchema = z.object({ public_key: z.string() });

const transactionsSchema = z.object({
  transactions: z.array(
    z.object({
      hash: z.string(),
      lt: jsonBigint,
      utime: jsonNumber,
      success: z.boolean().optional(),
      in_msg: z.object({ value: jsonBigint.optional() }).optional(),
    }),
  ),
});

export interface TonAccount {
  address: string;
  balance: bigint;
  status: string;
}

export interface JettonBalance {
  master: string;
  name: string;
  symbol: string;
  decimals: number;
  amount: bigint;
  verification?: string;
}

export interface TonTransaction {
  hash: string;
  lt: bigint;
  utime: number;
  success: boolean;
  /** Incoming value in nanoton (0 for outgoing-only transactions). */
  valueIn: bigint;
}

export interface TonApiClientOptions {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  retries?: number;
  backoffBaseMs?: number;
  fetchFn?: typeof fetch;
  sleepFn?: (ms: number) => Promise<void>;
}

export class TonApiClient {
  private readonly http: JsonHttpClient;

  constructor(options: TonApiClientOptions = {}) {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (options.apiKey) {
      headers.Authorization = `Bearer ${options.apiKey}`;
    }
    this.http = new JsonHttpClient({
      baseUrl: options.baseUrl ?? 'https://tonapi.io',
      headers,
      ...(options.timeoutMs !== undefined && { timeoutMs: options.timeoutMs }),
      ...(options.retries !== undefined && { retries: options.retries }),
      ...(options.backoffBaseMs !== undefined && { backoffBaseMs: options.backoffBaseMs }),
      ...(options.fetchFn !== undefined && { fetchFn: options.fetchFn }),
      ...(options.sleepFn !== undefined && { sleepFn: options.sleepFn }),
    });
  }

  async getAccount(address: string): Promise<TonAccount> {
    try {
      const data = await this.http.get(`/v2/accounts/${address}`, accountSchema);
      return { address: data.address, balance: data.balance, status: data.status };
    } catch (error) {
      if (error instanceof NotFoundError) {
        return { address, balance: 0n, status: 'nonexist' };
      }
      throw error;
    }
  }

  async getJettonBalances(address: string): Promise<JettonBalance[]> {
    try {
      const data = await this.http.get(`/v2/accounts/${address}/jettons`, jettonBalancesSchema);
      return data.balances.map((entry) => ({
        master: entry.jetton.address,
        name: entry.jetton.name,
        symbol: entry.jetton.symbol,
        decimals: entry.jetton.decimals,
        amount: entry.balance,
        ...(entry.jetton.verification !== undefined && {
          verification: entry.jetton.verification,
        }),
      }));
    } catch (error) {
      if (error instanceof NotFoundError) return [];
      throw error;
    }
  }

  /** Hex-encoded ed25519 public key of a deployed wallet (used by ton_proof). */
  async getAccountPublicKey(address: string): Promise<string> {
    const data = await this.http.get(`/v2/accounts/${address}/publickey`, publicKeySchema);
    return data.public_key;
  }

  async getTransactions(
    address: string,
    options: { limit?: number; afterLt?: bigint; beforeLt?: bigint } = {},
  ): Promise<TonTransaction[]> {
    const query: Record<string, string> = {
      limit: String(options.limit ?? 50),
      sort_order: 'desc',
    };
    if (options.afterLt !== undefined) {
      query.after_lt = options.afterLt.toString();
    }
    if (options.beforeLt !== undefined) {
      query.before_lt = options.beforeLt.toString();
    }
    const data = await this.http.get(
      `/v2/blockchain/accounts/${address}/transactions`,
      transactionsSchema,
      query,
    );
    return data.transactions.map((tx) => ({
      hash: tx.hash,
      lt: tx.lt,
      utime: tx.utime,
      success: tx.success ?? true,
      valueIn: tx.in_msg?.value ?? 0n,
    }));
  }
}
