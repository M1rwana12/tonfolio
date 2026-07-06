import { AlertType, AssetKind, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FIAT_SCALE = 1e9;
const UAH_PER_USD = 41.7;
const HISTORY_HOURS = 30 * 24;
const HOUR_MS = 60 * 60 * 1000;

/** Deterministic PRNG — the seed is reproducible run to run. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toFiat(usd: number): bigint {
  return BigInt(Math.round(usd * FIAT_SCALE));
}

interface AssetSeed {
  kind: AssetKind;
  symbol: string;
  name: string;
  decimals: number;
  jettonMaster: string | null;
  coingeckoId: string | null;
  basePriceUsd: number;
  hourlyVolatility: number;
}

const ASSETS: AssetSeed[] = [
  {
    kind: AssetKind.NATIVE,
    symbol: 'TON',
    name: 'Toncoin',
    decimals: 9,
    jettonMaster: null,
    coingeckoId: 'the-open-network',
    basePriceUsd: 5.42,
    hourlyVolatility: 0.008,
  },
  {
    kind: AssetKind.JETTON,
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    jettonMaster: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
    coingeckoId: 'tether',
    basePriceUsd: 1.0,
    hourlyVolatility: 0.0004,
  },
  {
    kind: AssetKind.JETTON,
    symbol: 'NOT',
    name: 'Notcoin',
    decimals: 9,
    jettonMaster: 'EQAvlWFDxGF2lXm67y4yzC17wYKD9A0guwPkMs1gOsM__NOT',
    coingeckoId: 'notcoin',
    basePriceUsd: 0.00185,
    hourlyVolatility: 0.015,
  },
  {
    kind: AssetKind.JETTON,
    symbol: 'DOGS',
    name: 'Dogs',
    decimals: 9,
    jettonMaster: 'EQCvxJy4eG8hyHBFsZ7eePxrRsUQSFE_jpptRAYBmcG_DOGS',
    coingeckoId: 'dogs-2',
    basePriceUsd: 0.00052,
    hourlyVolatility: 0.02,
  },
  {
    kind: AssetKind.JETTON,
    symbol: 'STON',
    name: 'STON.fi',
    decimals: 9,
    jettonMaster: 'EQA2kCVNwVsil2EM2mB0SkXytxCqQjS4mttjDpnXmwG9T6bO',
    coingeckoId: 'ston',
    basePriceUsd: 0.55,
    hourlyVolatility: 0.012,
  },
  {
    kind: AssetKind.JETTON,
    symbol: 'SCALE',
    name: 'Scaleton',
    decimals: 9,
    jettonMaster: 'EQBlqsm144Dq6SjbPI4jjZvA1hqTIP3CvHovbIfW_t-SCALE',
    coingeckoId: null,
    basePriceUsd: 0.0021,
    hourlyVolatility: 0.018,
  },
];

async function wipe(): Promise<void> {
  await prisma.alertEvent.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.txCache.deleteMany();
  await prisma.holding.deleteMany();
  await prisma.portfolioSnapshot.deleteMany();
  await prisma.priceTick.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.user.deleteMany();
}

async function main(): Promise<void> {
  await wipe();

  const assets = new Map<string, { id: string }>();
  for (const seed of ASSETS) {
    const asset = await prisma.asset.create({
      data: {
        kind: seed.kind,
        symbol: seed.symbol,
        name: seed.name,
        decimals: seed.decimals,
        jettonMaster: seed.jettonMaster,
        coingeckoId: seed.coingeckoId,
      },
    });
    assets.set(seed.symbol, asset);
  }

  const user = await prisma.user.create({
    data: {
      telegramId: 700000001n,
      locale: 'uk',
      // 22:00 – 08:00 local time
      quietHoursStart: 22 * 60,
      quietHoursEnd: 8 * 60,
    },
  });

  const mainWallet = await prisma.wallet.create({
    data: {
      userId: user.id,
      addressRaw: '0:8a3f1c6bd2e94075ab11c9f0de6273c8b54c1a2f90d3e8b7a6f4c5d2e1908372',
      addressFriendly: 'UQCKPxxr0ulAdasRyfDeYnPItUwaL5DT6Lem9MXS4ZCDcs9O',
      label: 'Основний',
      verified: true,
      isWatchOnly: false,
    },
  });

  const watchWallet = await prisma.wallet.create({
    data: {
      userId: user.id,
      addressRaw: '0:3d5e9a17c4b28f60de92a5c31f78b0e4a6d1c8f25b39e07d4a8c6b1f2e50d9a3',
      addressFriendly: 'UQA9XpoXxLKPYN6SpcMfeLDkptHI8ls54H1KjGsfLlDZo9nJ',
      label: 'Whale watch',
      verified: false,
      isWatchOnly: true,
    },
  });

  const holdings: Array<{ walletId: string; symbol: string; amount: bigint }> = [
    { walletId: mainWallet.id, symbol: 'TON', amount: 1_250_500_000_000n }, // 1250.5 TON
    { walletId: mainWallet.id, symbol: 'USDT', amount: 800_250_000n }, // 800.25 USDT
    { walletId: mainWallet.id, symbol: 'NOT', amount: 150_000_000_000_000n }, // 150 000 NOT
    { walletId: mainWallet.id, symbol: 'DOGS', amount: 2_500_000_000_000_000n }, // 2 500 000 DOGS
    { walletId: mainWallet.id, symbol: 'STON', amount: 320_000_000_000n }, // 320 STON
    { walletId: watchWallet.id, symbol: 'TON', amount: 25_000_000_000_000n }, // 25 000 TON
  ];
  for (const holding of holdings) {
    const asset = assets.get(holding.symbol);
    if (!asset) throw new Error(`unknown asset in seed: ${holding.symbol}`);
    await prisma.holding.create({
      data: { walletId: holding.walletId, assetId: asset.id, amount: holding.amount },
    });
  }

  const now = Date.now();
  const historyStart = now - HISTORY_HOURS * HOUR_MS;

  let tickCount = 0;
  for (const seed of ASSETS) {
    const asset = assets.get(seed.symbol);
    if (!asset) continue;
    const random = mulberry32(seed.symbol.charCodeAt(0) * 7919 + seed.decimals);
    let price = seed.basePriceUsd;
    const ticks = [];
    for (let hour = 0; hour <= HISTORY_HOURS; hour += 1) {
      price *= 1 + (random() - 0.5) * 2 * seed.hourlyVolatility;
      ticks.push({
        assetId: asset.id,
        priceUsd: toFiat(price),
        priceUah: toFiat(price * UAH_PER_USD),
        source: 'seed',
        takenAt: new Date(historyStart + hour * HOUR_MS),
      });
    }
    await prisma.priceTick.createMany({ data: ticks });
    tickCount += ticks.length;
  }

  const snapshotRandom = mulberry32(42);
  let totalUsd = 8_200;
  const snapshots = [];
  for (let hour = 0; hour <= HISTORY_HOURS; hour += 6) {
    totalUsd *= 1 + (snapshotRandom() - 0.5) * 0.02;
    snapshots.push({
      userId: user.id,
      totalUsd: toFiat(totalUsd),
      totalUah: toFiat(totalUsd * UAH_PER_USD),
      takenAt: new Date(historyStart + hour * HOUR_MS),
    });
  }
  await prisma.portfolioSnapshot.createMany({ data: snapshots });

  const ton = assets.get('TON');
  if (!ton) throw new Error('TON asset missing after seed');
  await prisma.alert.create({
    data: {
      userId: user.id,
      type: AlertType.PRICE_ABOVE,
      params: { type: 'PRICE_ABOVE', assetId: ton.id, priceUsd: '6000000000' }, // $6.00
    },
  });

  console.log(
    `Seeded: ${ASSETS.length} assets, 2 wallets, ${holdings.length} holdings, ` +
      `${tickCount} price ticks, ${snapshots.length} snapshots, 1 alert.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
