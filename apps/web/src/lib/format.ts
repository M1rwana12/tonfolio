import { FIAT_DECIMALS, formatUnits } from '@tonfolio/shared';

export function usd(value: string | bigint, maxFraction = 2): string {
  return `$${formatUnits(BigInt(value), FIAT_DECIMALS, { maxFraction, minFraction: 2, group: true })}`;
}

export function tokenAmount(value: string | bigint, decimals: number): string {
  return formatUnits(BigInt(value), decimals, { maxFraction: 4, group: true });
}

/** Basis points → { text: "+2.51%", dir: 1|-1|0 } for change chips. */
export function pctChange(bps: string | null): { text: string; dir: -1 | 0 | 1 } | null {
  if (bps === null) return null;
  const value = BigInt(bps);
  const rendered = formatUnits(value, 2, { minFraction: 2 });
  if (value > 0n) return { text: `+${rendered}%`, dir: 1 };
  if (value < 0n) return { text: `${rendered}%`, dir: -1 };
  return { text: '0.00%', dir: 0 };
}

/** USD fixed-point (scale 9) → float dollars, chart/presentation layer only. */
export function usdToNumber(value: string | bigint): number {
  return Number(BigInt(value) / 10_000_000n) / 100;
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function shortHash(hash: string): string {
  return `${hash.slice(0, 8)}…`;
}
