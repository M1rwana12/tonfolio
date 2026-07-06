import { describe, expect, it } from 'vitest';

import { arrowForBps, escapeHtml, renderPortfolio, signedPercent } from './format.js';

describe('escapeHtml', () => {
  it('escapes HTML-sensitive characters', () => {
    expect(escapeHtml('<b>&"x"</b>')).toBe('&lt;b&gt;&amp;"x"&lt;/b&gt;');
  });
});

describe('arrowForBps', () => {
  it('points up for growth, down for decline, dash otherwise', () => {
    expect(arrowForBps(250n)).toBe('▲');
    expect(arrowForBps(-10n)).toBe('▼');
    expect(arrowForBps(0n)).toBe('▪');
    expect(arrowForBps(null)).toBe('▪');
  });
});

describe('signedPercent', () => {
  it('renders basis points as a signed percentage', () => {
    expect(signedPercent(2_534n)).toBe('+25.34%');
    expect(signedPercent(-120n)).toBe('-1.20%');
    expect(signedPercent(0n)).toBe('0.00%');
  });
});

describe('renderPortfolio', () => {
  const summary = {
    totalUsd: 3_038_810_000_000n,
    change24Bps: 187n,
    positions: [
      {
        symbol: 'TON',
        amount: 1_250_500_000_000n,
        decimals: 9,
        valueUsd: 2_238_400_000_000n,
        change24Bps: 251n,
      },
      {
        symbol: '<X>',
        amount: 800_250_000n,
        decimals: 6,
        valueUsd: 800_410_000_000n,
        change24Bps: null,
      },
    ],
  };

  it('renders amounts in monospace with arrows and total', () => {
    const html = renderPortfolio('uk', summary);

    expect(html).toContain('<code>');
    expect(html).toContain('TON');
    expect(html).toContain('▲');
    expect(html).toContain('+2.51%');
    expect(html).toContain('$3,038.81');
  });

  it('escapes asset symbols', () => {
    const html = renderPortfolio('uk', summary);

    expect(html).toContain('&lt;X&gt;');
    expect(html).not.toContain('<X>');
  });

  it('sorts positions by USD value descending', () => {
    const html = renderPortfolio('uk', summary);

    expect(html.indexOf('TON')).toBeLessThan(html.indexOf('&lt;X&gt;'));
  });
});
