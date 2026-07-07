import { bpsChange } from '@tonfolio/shared';
import type { AlertParamsOf } from '@tonfolio/shared';

/** Crossing semantics: fire only when the threshold is crossed between ticks. */
export function priceCrossedAbove(
  threshold: bigint,
  prev: bigint | null,
  current: bigint,
): boolean {
  if (current < threshold) return false;
  return prev !== null && prev < threshold;
}

export function priceCrossedBelow(
  threshold: bigint,
  prev: bigint | null,
  current: bigint,
): boolean {
  if (current > threshold) return false;
  return prev !== null && prev > threshold;
}

/** |change| over the window ≥ threshold (both directions). */
export function changeExceeded(
  thresholdBps: number,
  windowStartPrice: bigint,
  current: bigint,
): boolean {
  const bps = bpsChange(windowStartPrice, current);
  if (bps === null) return false;
  const abs = bps < 0n ? -bps : bps;
  return abs >= BigInt(thresholdBps);
}

/** Quiet window in minutes from local midnight; start > end wraps past midnight. */
export function isInQuietWindow(
  minutesNow: number,
  start: number | null,
  end: number | null,
): boolean {
  if (start === null || end === null || start === end) return false;
  if (start < end) return minutesNow >= start && minutesNow < end;
  return minutesNow >= start || minutesNow < end;
}

export function isCoolingDown(lastFiredAt: Date | null, cooldownSec: number, now: Date): boolean {
  if (lastFiredAt === null) return false;
  return now.getTime() - lastFiredAt.getTime() < cooldownSec * 1000;
}

export type FiringDecision = 'fire' | 'no-match' | 'cooldown' | 'quiet';

export type PriceAlertParams =
  AlertParamsOf<'PRICE_ABOVE'> | AlertParamsOf<'PRICE_BELOW'> | AlertParamsOf<'PRICE_CHANGE_PCT'>;

export interface PriceAlertInput {
  params: PriceAlertParams;
  lastFiredAt: Date | null;
  cooldownSec: number;
  quiet: { minutesNow: number; start: number | null; end: number | null };
  price: { prev: bigint | null; current: bigint };
  windowStartPrice?: bigint | null;
  now: Date;
}

export function decidePriceAlert(input: PriceAlertInput): FiringDecision {
  const { params, price } = input;
  let matched: boolean;
  switch (params.type) {
    case 'PRICE_ABOVE':
      matched = priceCrossedAbove(BigInt(params.priceUsd), price.prev, price.current);
      break;
    case 'PRICE_BELOW':
      matched = priceCrossedBelow(BigInt(params.priceUsd), price.prev, price.current);
      break;
    case 'PRICE_CHANGE_PCT':
      matched =
        input.windowStartPrice !== null &&
        input.windowStartPrice !== undefined &&
        changeExceeded(params.thresholdBps, input.windowStartPrice, price.current);
      break;
  }
  if (!matched) return 'no-match';
  return applyGuards(input);
}

export interface GuardsInput {
  lastFiredAt: Date | null;
  cooldownSec: number;
  quiet: { minutesNow: number; start: number | null; end: number | null };
  now: Date;
}

/** Shared for price and transaction alerts: cooldown first, then quiet hours. */
export function applyGuards(input: GuardsInput): Exclude<FiringDecision, 'no-match'> {
  if (isCoolingDown(input.lastFiredAt, input.cooldownSec, input.now)) return 'cooldown';
  if (isInQuietWindow(input.quiet.minutesNow, input.quiet.start, input.quiet.end)) return 'quiet';
  return 'fire';
}

/** User-local minutes from midnight; falls back to UTC on a broken timezone. */
export function minutesFromMidnight(date: Date, timeZone: string): number {
  try {
    const formatted = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(date);
    const [hours = 0, minutes = 0] = formatted.split(':').map(Number);
    return hours * 60 + minutes;
  } catch {
    return date.getUTCHours() * 60 + date.getUTCMinutes();
  }
}
