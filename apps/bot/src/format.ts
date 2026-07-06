import { FIAT_DECIMALS, formatUnits } from '@tonfolio/shared';
import type { Locale } from '@tonfolio/shared';

import { t } from './i18n.js';

export function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function arrowForBps(bps: bigint | null): string {
  if (bps === null || bps === 0n) return '▪';
  return bps > 0n ? '▲' : '▼';
}

/** Basis points → "+25.34%" (bps are hundredths of a percent, i.e. 2 decimals). */
export function signedPercent(bps: bigint): string {
  const rendered = formatUnits(bps, 2, { minFraction: 2 });
  return bps > 0n ? `+${rendered}%` : `${rendered}%`;
}

export function formatUsd(value: bigint, maxFraction = 2): string {
  return `$${formatUnits(value, FIAT_DECIMALS, { maxFraction, group: true, minFraction: 2 })}`;
}

export interface PortfolioPosition {
  symbol: string;
  amount: bigint;
  decimals: number;
  valueUsd: bigint;
  change24Bps: bigint | null;
}

export interface PortfolioSummaryView {
  totalUsd: bigint;
  change24Bps: bigint | null;
  positions: PortfolioPosition[];
}

export function renderPortfolio(locale: Locale, summary: PortfolioSummaryView): string {
  const sorted = [...summary.positions].sort((a, b) => (b.valueUsd > a.valueUsd ? 1 : -1));
  const symbolWidth = Math.max(...sorted.map((p) => p.symbol.length), 4);
  const amounts = sorted.map((p) =>
    formatUnits(p.amount, p.decimals, { maxFraction: 2, group: true }),
  );
  const amountWidth = Math.max(...amounts.map((a) => a.length));

  const lines = sorted.map((position, index) => {
    const symbol = escapeHtml(position.symbol.padEnd(symbolWidth));
    const amount = (amounts[index] ?? '').padStart(amountWidth);
    const value = formatUsd(position.valueUsd);
    const change =
      position.change24Bps === null
        ? ''
        : `  ${arrowForBps(position.change24Bps)} ${signedPercent(position.change24Bps)}`;
    return `<code>${symbol} ${amount}</code>  ${value}${change}`;
  });

  const totalChange =
    summary.change24Bps === null
      ? ''
      : `  ${arrowForBps(summary.change24Bps)} ${signedPercent(summary.change24Bps)} (${t(
          locale,
          'portfolioChangeSuffix',
        )})`;

  return [
    t(locale, 'portfolioTitle'),
    '',
    ...lines,
    '',
    `💰 <b>${t(locale, 'portfolioTotal')}: ${formatUsd(summary.totalUsd)}</b>${totalChange}`,
  ].join('\n');
}
