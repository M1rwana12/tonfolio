import { describe, expect, it } from 'vitest';

import {
  changeExceeded,
  decidePriceAlert,
  isCoolingDown,
  isInQuietWindow,
  priceCrossedAbove,
  priceCrossedBelow,
} from './decide.js';

const NOW = new Date('2026-07-07T12:00:00Z');

describe('priceCrossedAbove', () => {
  it('fires when the price crosses the threshold from below', () => {
    expect(priceCrossedAbove(5_000n, 4_900n, 5_100n)).toBe(true);
  });

  it('does not fire while the price stays above the threshold', () => {
    expect(priceCrossedAbove(5_000n, 5_050n, 5_100n)).toBe(false);
  });

  it('fires when the price lands exactly on the threshold', () => {
    expect(priceCrossedAbove(5_000n, 4_999n, 5_000n)).toBe(true);
  });

  it('does not fire without a previous observation', () => {
    expect(priceCrossedAbove(5_000n, null, 5_100n)).toBe(false);
  });
});

describe('priceCrossedBelow', () => {
  it('fires when the price crosses the threshold from above', () => {
    expect(priceCrossedBelow(5_000n, 5_100n, 4_900n)).toBe(true);
  });

  it('does not fire while the price stays below', () => {
    expect(priceCrossedBelow(5_000n, 4_800n, 4_700n)).toBe(false);
  });

  it('fires exactly on the boundary', () => {
    expect(priceCrossedBelow(5_000n, 5_001n, 5_000n)).toBe(true);
  });
});

describe('changeExceeded', () => {
  it('fires on a rise beyond the threshold', () => {
    // +6% vs 500 bps threshold
    expect(changeExceeded(500, 1_000n, 1_060n)).toBe(true);
  });

  it('fires on a drop beyond the threshold', () => {
    expect(changeExceeded(500, 1_000n, 940n)).toBe(true);
  });

  it('stays silent within the corridor', () => {
    expect(changeExceeded(500, 1_000n, 1_030n)).toBe(false);
  });
});

describe('isInQuietWindow', () => {
  it('detects a normal daytime window', () => {
    expect(isInQuietWindow(13 * 60, 12 * 60, 14 * 60)).toBe(true);
    expect(isInQuietWindow(15 * 60, 12 * 60, 14 * 60)).toBe(false);
  });

  it('handles a window wrapping past midnight', () => {
    const start = 22 * 60;
    const end = 8 * 60;
    expect(isInQuietWindow(23 * 60, start, end)).toBe(true);
    expect(isInQuietWindow(3 * 60, start, end)).toBe(true);
    expect(isInQuietWindow(12 * 60, start, end)).toBe(false);
  });

  it('is disabled when not configured', () => {
    expect(isInQuietWindow(3 * 60, null, null)).toBe(false);
  });
});

describe('isCoolingDown', () => {
  it('suppresses re-firing inside the cooldown', () => {
    const fired = new Date(NOW.getTime() - 30 * 60 * 1000);
    expect(isCoolingDown(fired, 3600, NOW)).toBe(true);
  });

  it('allows firing after the cooldown has passed', () => {
    const fired = new Date(NOW.getTime() - 2 * 3600 * 1000);
    expect(isCoolingDown(fired, 3600, NOW)).toBe(false);
  });

  it('allows the very first firing', () => {
    expect(isCoolingDown(null, 3600, NOW)).toBe(false);
  });
});

describe('decidePriceAlert', () => {
  const base = {
    lastFiredAt: null,
    cooldownSec: 3600,
    quiet: { minutesNow: 12 * 60, start: null, end: null },
    now: NOW,
  };

  it('fires a PRICE_ABOVE alert on crossing', () => {
    const decision = decidePriceAlert({
      ...base,
      params: { type: 'PRICE_ABOVE', assetId: 'a', priceUsd: '5000' },
      price: { prev: 4_900n, current: 5_100n },
    });
    expect(decision).toBe('fire');
  });

  it('reports no-match when nothing crossed', () => {
    const decision = decidePriceAlert({
      ...base,
      params: { type: 'PRICE_ABOVE', assetId: 'a', priceUsd: '5000' },
      price: { prev: 5_100n, current: 5_200n },
    });
    expect(decision).toBe('no-match');
  });

  it('suppresses a match during cooldown', () => {
    const decision = decidePriceAlert({
      ...base,
      lastFiredAt: new Date(NOW.getTime() - 60 * 1000),
      params: { type: 'PRICE_BELOW', assetId: 'a', priceUsd: '5000' },
      price: { prev: 5_100n, current: 4_900n },
    });
    expect(decision).toBe('cooldown');
  });

  it('suppresses a match during quiet hours', () => {
    const decision = decidePriceAlert({
      ...base,
      quiet: { minutesNow: 23 * 60, start: 22 * 60, end: 8 * 60 },
      params: { type: 'PRICE_BELOW', assetId: 'a', priceUsd: '5000' },
      price: { prev: 5_100n, current: 4_900n },
    });
    expect(decision).toBe('quiet');
  });

  it('fires PRICE_CHANGE_PCT when the window move exceeds the threshold', () => {
    const decision = decidePriceAlert({
      ...base,
      params: {
        type: 'PRICE_CHANGE_PCT',
        assetId: 'a',
        thresholdBps: 500,
        windowMinutes: 60,
      },
      price: { prev: null, current: 1_060n },
      windowStartPrice: 1_000n,
    });
    expect(decision).toBe('fire');
  });

  it('reports no-match for PRICE_CHANGE_PCT without window data', () => {
    const decision = decidePriceAlert({
      ...base,
      params: {
        type: 'PRICE_CHANGE_PCT',
        assetId: 'a',
        thresholdBps: 500,
        windowMinutes: 60,
      },
      price: { prev: null, current: 1_060n },
      windowStartPrice: null,
    });
    expect(decision).toBe('no-match');
  });
});
