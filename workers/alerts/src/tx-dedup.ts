import type { PrismaClient } from '@tonfolio/db';

export interface SeenTx {
  hash: string;
  lt: bigint;
}

/** Persistence contract for the TxCache table — faked in unit tests. */
export interface TxCacheRepo {
  findSeenHashes(walletId: string, hashes: readonly string[]): Promise<readonly string[]>;
  saveSeen(walletId: string, txs: readonly SeenTx[]): Promise<void>;
}

/**
 * Returns only transactions this wallet has not produced notifications for yet
 * and records them, so every transaction is reported at most once.
 */
export async function filterNewTransactions<T extends SeenTx>(
  repo: TxCacheRepo,
  walletId: string,
  txs: readonly T[],
): Promise<T[]> {
  if (txs.length === 0) return [];
  const seen = new Set(
    await repo.findSeenHashes(
      walletId,
      txs.map((tx) => tx.hash),
    ),
  );
  const fresh = txs.filter((tx) => !seen.has(tx.hash));
  if (fresh.length > 0) {
    await repo.saveSeen(walletId, fresh);
  }
  return fresh;
}

export function prismaTxCacheRepo(prisma: PrismaClient): TxCacheRepo {
  return {
    async findSeenHashes(walletId, hashes) {
      const rows = await prisma.txCache.findMany({
        where: { walletId, txHash: { in: [...hashes] } },
        select: { txHash: true },
      });
      return rows.map((row) => row.txHash);
    },
    async saveSeen(walletId, txs) {
      await prisma.txCache.createMany({
        data: txs.map((tx) => ({ walletId, txHash: tx.hash, lt: tx.lt })),
        skipDuplicates: true,
      });
    },
  };
}
