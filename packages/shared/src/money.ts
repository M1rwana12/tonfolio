import { TON_DECIMALS } from './constants.js';

export type Rounding = 'trunc' | 'half-up';

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

const DECIMAL_RE = /^-?\d+(\.\d+)?$/;
const MAX_DECIMALS = 30;

function assertDecimals(decimals: number): void {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > MAX_DECIMALS) {
    throw new MoneyError(`decimals must be an integer in [0, ${MAX_DECIMALS}], got ${decimals}`);
  }
}

function pow10(exponent: number): bigint {
  return 10n ** BigInt(exponent);
}

/** Integer division with an explicit rounding mode; sign-aware for negative values. */
export function roundDiv(value: bigint, divisor: bigint, rounding: Rounding = 'trunc'): bigint {
  if (divisor <= 0n) {
    throw new MoneyError(`divisor must be positive, got ${divisor}`);
  }
  const quotient = value / divisor;
  if (rounding === 'trunc') {
    return quotient;
  }
  const remainder = value % divisor;
  const doubledAbs = (remainder < 0n ? -remainder : remainder) * 2n;
  if (doubledAbs >= divisor) {
    return quotient + (value < 0n ? -1n : 1n);
  }
  return quotient;
}

/** Parses a human decimal string ("1.5") into minimal units at the given decimals. */
export function parseUnits(value: string, decimals: number): bigint {
  assertDecimals(decimals);
  if (!DECIMAL_RE.test(value)) {
    throw new MoneyError(`not a decimal number: "${value}"`);
  }
  const negative = value.startsWith('-');
  const digits = negative ? value.slice(1) : value;
  const [intPart = '0', fracPart = ''] = digits.split('.');
  if (fracPart.length > decimals) {
    throw new MoneyError(
      `"${value}" has ${fracPart.length} fraction digits, asset allows ${decimals}`,
    );
  }
  const units = BigInt(intPart) * pow10(decimals) + BigInt(fracPart.padEnd(decimals, '0') || '0');
  return negative ? -units : units;
}

export interface FormatUnitsOptions {
  /** Show at most this many fraction digits (default: all). */
  maxFraction?: number;
  /** Pad the fraction with zeros up to this many digits (default: 0 — trim trailing zeros). */
  minFraction?: number;
  rounding?: Rounding;
  /** Group the integer part in thousands. */
  group?: boolean;
  groupSeparator?: string;
}

/** Formats minimal units into a human decimal string. Presentation layer only. */
export function formatUnits(
  amount: bigint,
  decimals: number,
  options: FormatUnitsOptions = {},
): string {
  assertDecimals(decimals);
  const {
    maxFraction = decimals,
    minFraction = 0,
    rounding = 'trunc',
    group = false,
    groupSeparator = ',',
  } = options;
  const shownFraction = Math.min(Math.max(maxFraction, 0), decimals);

  const scaled = roundDiv(amount, pow10(decimals - shownFraction), rounding);
  const negative = scaled < 0n;
  const abs = negative ? -scaled : scaled;
  const base = pow10(shownFraction);

  let intPart = (abs / base).toString();
  let fracPart = (abs % base).toString().padStart(shownFraction, '0');

  while (fracPart.length > minFraction && fracPart.endsWith('0')) {
    fracPart = fracPart.slice(0, -1);
  }
  if (fracPart.length < minFraction) {
    fracPart = fracPart.padEnd(minFraction, '0');
  }
  if (group) {
    intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, groupSeparator);
  }

  const rendered = fracPart.length > 0 ? `${intPart}.${fracPart}` : intPart;
  return negative ? `-${rendered}` : rendered;
}

export function toNano(value: string): bigint {
  return parseUnits(value, TON_DECIMALS);
}

export function fromNano(amount: bigint, options?: FormatUnitsOptions): string {
  return formatUnits(amount, TON_DECIMALS, options);
}

/** Re-scales minimal units between assets with different decimals. */
export function scaleUnits(
  amount: bigint,
  fromDecimals: number,
  toDecimals: number,
  rounding: Rounding = 'trunc',
): bigint {
  assertDecimals(fromDecimals);
  assertDecimals(toDecimals);
  if (toDecimals >= fromDecimals) {
    return amount * pow10(toDecimals - fromDecimals);
  }
  return roundDiv(amount, pow10(fromDecimals - toDecimals), rounding);
}

/**
 * Value of an asset amount at a fixed-point fiat price (FIAT_DECIMALS scale).
 * Result stays at the same fiat scale as the price.
 */
export function valueInFiat(
  amount: bigint,
  assetDecimals: number,
  price: bigint,
  rounding: Rounding = 'trunc',
): bigint {
  assertDecimals(assetDecimals);
  return roundDiv(amount * price, pow10(assetDecimals), rounding);
}

/** Relative change in basis points (1% = 100 bps); null when the base is zero. */
export function bpsChange(base: bigint, current: bigint): bigint | null {
  if (base === 0n) {
    return null;
  }
  const abs = base < 0n ? -base : base;
  return ((current - base) * 10_000n) / abs;
}
