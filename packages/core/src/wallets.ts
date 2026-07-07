import type { PrismaClient, Wallet } from '@tonfolio/db';
import { MAX_WATCH_ONLY_WALLETS } from '@tonfolio/shared';
import { parseTonAddress } from '@tonfolio/ton';
import type { ParsedTonAddress, TonApiClient } from '@tonfolio/ton';

/** Reads live balances from tonapi and stores a fresh Holding snapshot. */
export async function syncWalletHoldings(
  prisma: PrismaClient,
  tonapi: TonApiClient,
  wallet: Pick<Wallet, 'id' | 'addressFriendly'>,
): Promise<number> {
  const account = await tonapi.getAccount(wallet.addressFriendly);
  const jettons = await tonapi.getJettonBalances(wallet.addressFriendly);
  const observedAt = new Date();
  const rows: Array<{ walletId: string; assetId: string; amount: bigint; observedAt: Date }> = [];

  if (account.balance > 0n) {
    const tonAsset = await prisma.asset.findFirst({ where: { kind: 'NATIVE' } });
    if (tonAsset) {
      rows.push({ walletId: wallet.id, assetId: tonAsset.id, amount: account.balance, observedAt });
    }
  }

  for (const jetton of jettons) {
    if (jetton.amount <= 0n) continue;
    if (jetton.verification === 'blacklist') continue;
    const master = parseTonAddress(jetton.master)?.raw ?? jetton.master;
    let asset = await prisma.asset.findUnique({ where: { jettonMaster: master } });
    asset ??= await prisma.asset.create({
      data: {
        kind: 'JETTON',
        symbol: jetton.symbol,
        name: jetton.name,
        decimals: jetton.decimals,
        jettonMaster: master,
      },
    });
    rows.push({ walletId: wallet.id, assetId: asset.id, amount: jetton.amount, observedAt });
  }

  if (rows.length > 0) {
    await prisma.holding.createMany({
      data: rows.map((row) => ({ ...row, amount: row.amount.toString() })),
    });
  }
  return rows.length;
}

export type AddWalletResult =
  { ok: true; wallet: Wallet; assets: number } | { ok: false; reason: 'duplicate' | 'limit' };

export async function addWatchWallet(
  prisma: PrismaClient,
  tonapi: TonApiClient,
  userId: string,
  address: ParsedTonAddress,
): Promise<AddWalletResult> {
  const existing = await prisma.wallet.findUnique({
    where: { userId_addressRaw: { userId, addressRaw: address.raw } },
  });
  if (existing) return { ok: false, reason: 'duplicate' };

  const watchCount = await prisma.wallet.count({ where: { userId, isWatchOnly: true } });
  if (watchCount >= MAX_WATCH_ONLY_WALLETS) return { ok: false, reason: 'limit' };

  const wallet = await prisma.wallet.create({
    data: {
      userId,
      addressRaw: address.raw,
      addressFriendly: address.friendly,
      isWatchOnly: true,
    },
  });

  let assets = 0;
  try {
    assets = await syncWalletHoldings(prisma, tonapi, wallet);
  } catch (error) {
    // wallet stays; balances will be picked up by the next sync
    console.warn(`[wallets] holdings sync failed for ${wallet.addressFriendly}:`, error);
  }
  return { ok: true, wallet, assets };
}

/**
 * Links a TON Connect wallet after successful ton_proof verification.
 * Re-links an existing watch-only wallet instead of duplicating it.
 */
export async function linkVerifiedWallet(
  prisma: PrismaClient,
  tonapi: TonApiClient,
  userId: string,
  address: ParsedTonAddress,
): Promise<Wallet> {
  const wallet = await prisma.wallet.upsert({
    where: { userId_addressRaw: { userId, addressRaw: address.raw } },
    update: { verified: true, isWatchOnly: false },
    create: {
      userId,
      addressRaw: address.raw,
      addressFriendly: address.friendly,
      verified: true,
      isWatchOnly: false,
    },
  });
  try {
    await syncWalletHoldings(prisma, tonapi, wallet);
  } catch (error) {
    console.warn(`[wallets] holdings sync failed for ${wallet.addressFriendly}:`, error);
  }
  return wallet;
}
