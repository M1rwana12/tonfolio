import type { AlertStatus } from '@tonfolio/db';
import type { Locale } from '@tonfolio/shared';
import { InlineKeyboard } from 'grammy';

import type { BotContext, BotDeps } from './context.js';
import { escapeHtml, renderPortfolio } from './format.js';
import { t } from './i18n.js';
import { listAlertViews } from './services/alerts.js';
import { getPortfolioSummary } from '@tonfolio/core';

export async function sendPortfolio(ctx: BotContext, deps: BotDeps): Promise<void> {
  const locale = ctx.user.locale;
  const summary = await getPortfolioSummary(deps, ctx.user.id);
  if (!summary || summary.positions.length === 0) {
    await ctx.reply(t(locale, 'portfolioEmpty'));
    return;
  }
  const keyboard = deps.env.WEB_APP_URL?.startsWith('https://')
    ? new InlineKeyboard().url(t(locale, 'openMiniApp'), deps.env.WEB_APP_URL)
    : undefined;
  await ctx.reply(renderPortfolio(locale, summary), {
    parse_mode: 'HTML',
    ...(keyboard && { reply_markup: keyboard }),
  });
}

function statusIcon(status: AlertStatus): string {
  if (status === 'PAUSED') return '⏸';
  if (status === 'TRIGGERED') return '✅';
  return '🟢';
}

export async function buildAlertsView(
  deps: BotDeps,
  userId: string,
  locale: Locale,
): Promise<{ text: string; keyboard: InlineKeyboard }> {
  const views = await listAlertViews(deps.prisma, userId);
  const keyboard = new InlineKeyboard();
  const lines: string[] = [];

  views.forEach((view, index) => {
    lines.push(`${index + 1}. ${statusIcon(view.status)} ${escapeHtml(view.label)}`);
    const toggle =
      view.status === 'PAUSED'
        ? { label: `${index + 1} ▶️`, action: `alert:r:${view.id}` }
        : { label: `${index + 1} ⏸`, action: `alert:p:${view.id}` };
    keyboard
      .text(toggle.label, toggle.action)
      .text(`${index + 1} 🗑`, `alert:d:${view.id}`)
      .row();
  });
  keyboard.text(t(locale, 'alertsCreateButton'), 'alert:new');

  const body = lines.length > 0 ? lines.join('\n') : t(locale, 'alertsEmpty');
  return { text: `${t(locale, 'alertsTitle')}\n\n${body}`, keyboard };
}

export async function sendAlerts(ctx: BotContext, deps: BotDeps): Promise<void> {
  const { text, keyboard } = await buildAlertsView(deps, ctx.user.id, ctx.user.locale);
  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
}

export async function sendLanguageChooser(ctx: BotContext): Promise<void> {
  const keyboard = new InlineKeyboard()
    .text('🇺🇦 Українська', 'lang:uk')
    .text('🇬🇧 English', 'lang:en');
  await ctx.reply(t(ctx.user.locale, 'chooseLanguage'), { reply_markup: keyboard });
}
