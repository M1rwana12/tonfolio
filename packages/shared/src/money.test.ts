import { describe, expect, it } from 'vitest';

import {
  bpsChange,
  formatUnits,
  fromNano,
  fromNumber,
  parseUnits,
  scaleUnits,
  toNano,
  valueInFiat,
} from './money.js';

describe('parseUnits', () => {
  it('parses a decimal string into minimal units', () => {
    expect(parseUnits('1.5', 9)).toBe(1_500_000_000n);
  });

  it('parses amounts of 6-decimal assets like USDT', () => {
    expect(parseUnits('250.75', 6)).toBe(250_750_000n);
  });

  it('parses integers when the asset has zero decimals', () => {
    expect(parseUnits('123', 0)).toBe(123n);
  });

  it('preserves the sign for negative amounts below one', () => {
    expect(parseUnits('-0.5', 9)).toBe(-500_000_000n);
  });

  it('throws when the fraction exceeds asset decimals', () => {
    expect(() => parseUnits('0.1234567', 6)).toThrow();
  });

  it('throws on malformed input', () => {
    expect(() => parseUnits('1.2.3', 9)).toThrow();
    expect(() => parseUnits('abc', 9)).toThrow();
    expect(() => parseUnits('', 9)).toThrow();
  });
});

describe('formatUnits', () => {
  it('formats minimal units into a decimal string', () => {
    expect(formatUnits(1_500_000_000n, 9)).toBe('1.5');
  });

  it('trims trailing zeros down to a bare integer', () => {
    expect(formatUnits(1_000_000_000n, 9)).toBe('1');
  });

  it('truncates extra fraction digits by default', () => {
    expect(formatUnits(1_999_999_999n, 9, { maxFraction: 2 })).toBe('1.99');
  });

  it('rounds half-up when requested', () => {
    expect(formatUnits(1_999_999_999n, 9, { maxFraction: 2, rounding: 'half-up' })).toBe('2');
  });

  it('carries half-up rounding across the integer boundary', () => {
    expect(formatUnits(999_999_999n, 9, { maxFraction: 2, rounding: 'half-up' })).toBe('1');
  });

  it('formats negative amounts', () => {
    expect(formatUnits(-1_234_500_000n, 9)).toBe('-1.2345');
  });

  it('groups the integer part of large numbers', () => {
    expect(formatUnits(123_456_789_000_000_000n, 9, { group: true })).toBe('123,456,789');
  });

  it('pads the fraction up to minFraction digits', () => {
    expect(formatUnits(1_000_000_000n, 9, { minFraction: 2 })).toBe('1.00');
  });
});

describe('toNano / fromNano', () => {
  it('round-trips a TON amount', () => {
    expect(fromNano(toNano('3.14'))).toBe('3.14');
  });
});

describe('scaleUnits', () => {
  it('scales up when the target has more decimals', () => {
    expect(scaleUnits(1_500_000n, 6, 9)).toBe(1_500_000_000n);
  });

  it('scales down with truncation by default', () => {
    expect(scaleUnits(1_999n, 3, 0)).toBe(1n);
  });

  it('scales down with half-up rounding when requested', () => {
    expect(scaleUnits(1_999n, 3, 0, 'half-up')).toBe(2n);
  });
});

describe('valueInFiat', () => {
  it('computes the USD value at a fixed-point price', () => {
    // 2 TON × $5.4321 = $10.8642
    expect(valueInFiat(2_000_000_000n, 9, 5_432_100_000n)).toBe(10_864_200_000n);
  });

  it('keeps precision for tiny jetton prices', () => {
    // 1000 tokens × $0.000001234 = $0.001234
    expect(valueInFiat(1_000_000_000_000n, 9, 1_234n)).toBe(1_234_000n);
  });

  it('handles 6-decimal assets', () => {
    // 250.75 USDT × $1.0002 = $250.80015
    expect(valueInFiat(250_750_000n, 6, 1_000_200_000n)).toBe(250_800_150_000n);
  });
});

describe('fromNumber', () => {
  it('converts an API float price into fixed-point units', () => {
    expect(fromNumber(5.42, 9)).toBe(5_420_000_000n);
  });

  it('handles scientific notation for tiny prices', () => {
    expect(fromNumber(1.234e-7, 9)).toBe(123n);
  });

  it('absorbs float artifacts by rounding to the target scale', () => {
    expect(fromNumber(0.1 + 0.2, 9)).toBe(300_000_000n);
  });

  it('rejects non-finite values', () => {
    expect(() => fromNumber(Number.NaN, 9)).toThrow();
    expect(() => fromNumber(Number.POSITIVE_INFINITY, 9)).toThrow();
  });
});

describe('bpsChange', () => {
  it('reports growth in basis points', () => {
    expect(bpsChange(100n, 125n)).toBe(2_500n);
  });

  it('reports negative deltas', () => {
    expect(bpsChange(100n, 80n)).toBe(-2_000n);
  });

  it('returns null when the base is zero', () => {
    expect(bpsChange(0n, 50n)).toBeNull();
  });
});
