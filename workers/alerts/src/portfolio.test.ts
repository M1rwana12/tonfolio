import { describe, expect, it } from 'vitest';

import { computePortfolioTotals } from './portfolio.js';

describe('computePortfolioTotals', () => {
  it('sums fixed-point values across assets with different decimals', () => {
    const totals = computePortfolioTotals([
      // 2 TON @ $5.00 / ₴208.50
      {
        amount: 2_000_000_000n,
        decimals: 9,
        price: { usd: 5_000_000_000n, uah: 208_500_000_000n },
      },
      // 100 USDT @ $1.00 / ₴41.70
      { amount: 100_000_000n, decimals: 6, price: { usd: 1_000_000_000n, uah: 41_700_000_000n } },
    ]);

    expect(totals).toEqual({
      totalUsd: 110_000_000_000n, // $110
      totalUah: 4_587_000_000_000n, // ₴4587
    });
  });

  it('ignores positions without a known price', () => {
    const totals = computePortfolioTotals([
      {
        amount: 1_000_000_000n,
        decimals: 9,
        price: { usd: 5_000_000_000n, uah: 208_500_000_000n },
      },
      { amount: 999_000_000_000n, decimals: 9, price: null },
    ]);

    expect(totals.totalUsd).toBe(5_000_000_000n);
  });

  it('returns zero totals for an empty portfolio', () => {
    expect(computePortfolioTotals([])).toEqual({ totalUsd: 0n, totalUah: 0n });
  });
});
