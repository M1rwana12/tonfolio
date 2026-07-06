import { valueInFiat } from '@tonfolio/shared';
import type { FiatPrice } from '@tonfolio/ton';

export interface Position {
  /** Minimal units of the asset. */
  amount: bigint;
  decimals: number;
  /** Latest known price; null when the asset has no price source. */
  price: FiatPrice | null;
}

export interface PortfolioTotals {
  totalUsd: bigint;
  totalUah: bigint;
}

export function computePortfolioTotals(positions: readonly Position[]): PortfolioTotals {
  let totalUsd = 0n;
  let totalUah = 0n;
  for (const position of positions) {
    if (!position.price) continue;
    totalUsd += valueInFiat(position.amount, position.decimals, position.price.usd);
    totalUah += valueInFiat(position.amount, position.decimals, position.price.uah);
  }
  return { totalUsd, totalUah };
}
