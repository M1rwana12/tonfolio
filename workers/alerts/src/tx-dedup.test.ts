import { describe, expect, it } from 'vitest';

import type { SeenTx, TxCacheRepo } from './tx-dedup.js';
import { filterNewTransactions } from './tx-dedup.js';

function fakeRepo(seenHashes: string[]): TxCacheRepo & {
  saved: SeenTx[];
  lookups: number;
} {
  const saved: SeenTx[] = [];
  const state = {
    saved,
    lookups: 0,
    findSeenHashes(_walletId: string, hashes: readonly string[]): Promise<readonly string[]> {
      state.lookups += 1;
      return Promise.resolve(hashes.filter((hash) => seenHashes.includes(hash)));
    },
    saveSeen(_walletId: string, txs: readonly SeenTx[]): Promise<void> {
      saved.push(...txs);
      return Promise.resolve();
    },
  };
  return state;
}

const tx = (hash: string, lt: bigint): SeenTx => ({ hash, lt });

describe('filterNewTransactions', () => {
  it('returns and persists all transactions when none were seen', async () => {
    const repo = fakeRepo([]);
    const txs = [tx('a', 1n), tx('b', 2n)];

    const fresh = await filterNewTransactions(repo, 'w1', txs);

    expect(fresh).toEqual(txs);
    expect(repo.saved).toEqual(txs);
  });

  it('filters out transactions already present in the cache', async () => {
    const repo = fakeRepo(['a']);

    const fresh = await filterNewTransactions(repo, 'w1', [tx('a', 1n), tx('b', 2n)]);

    expect(fresh).toEqual([tx('b', 2n)]);
    expect(repo.saved).toEqual([tx('b', 2n)]);
  });

  it('skips the database entirely for an empty batch', async () => {
    const repo = fakeRepo([]);

    await expect(filterNewTransactions(repo, 'w1', [])).resolves.toEqual([]);
    expect(repo.lookups).toBe(0);
    expect(repo.saved).toEqual([]);
  });
});
