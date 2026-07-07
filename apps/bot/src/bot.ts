import { conversations, createConversation } from '@grammyjs/conversations';
import type { Locale } from '@tonfolio/shared';
import { Bot } from 'grammy';
import type { ApiClientOptions } from 'grammy';
import type { UserFromGetMe } from 'grammy/types';

import type { BaseContext, BotContext, BotDeps } from './context.js';
import { addWalletConversation, createAlertConversation } from './conversations.js';
import { buildAlertsView, sendAlerts, sendLanguageChooser, sendPortfolio } from './handlers.js';
import { t } from './i18n.js';
import { createMainMenu } from './menu.js';
import { deleteAlert, setAlertStatus } from './services/alerts.js';

export interface CreateBotOptions {
  botInfo?: UserFromGetMe;
  /** Test hook: replaces the Bot API transport (inherited by conversation contexts). */
  clientFetch?: ApiClientOptions['fetch'];
}

export function createBot(deps: BotDeps, options: CreateBotOptions = {}): Bot<BotContext> {
  const bot = new Bot<BotContext>(deps.env.BOT_TOKEN, {
    ...(options.botInfo && { botInfo: options.botInfo }),
    ...(options.clientFetch && { client: { fetch: options.clientFetch } }),
  });
  const { prisma } = deps;

  bot.catch((error) => {
    console.error('[bot] update failed:', error.error);
  });

  // upsert the DB user for every private update
  bot.use(async (ctx, next) => {
    const from = ctx.from;
    if (!from || from.is_bot) return;
    const mutable = ctx as BaseContext;
    const existing = await prisma.user.findUnique({ where: { telegramId: BigInt(from.id) } });
    if (existing) {
      mutable.user = existing;
      mutable.userCreated = false;
    } else {
      const locale: Locale = from.language_code === 'en' ? 'en' : 'uk';
      mutable.user = await prisma.user.create({
        data: { telegramId: BigInt(from.id), locale },
      });
      mutable.userCreated = true;
    }
    await next();
  });

  bot.use(conversations());
  bot.use(createConversation(addWalletConversation(deps), 'add-wallet'));
  bot.use(createConversation(createAlertConversation(deps), 'create-alert'));

  const mainMenu = createMainMenu(deps);
  bot.use(mainMenu);

  bot.command('start', async (ctx) => {
    if (ctx.userCreated) {
      await sendLanguageChooser(ctx);
      return;
    }
    await ctx.reply(t(ctx.user.locale, 'welcome'), {
      parse_mode: 'HTML',
      reply_markup: mainMenu,
    });
  });

  bot.command('language', (ctx) => sendLanguageChooser(ctx));
  bot.command('portfolio', (ctx) => sendPortfolio(ctx, deps));
  bot.command('add_wallet', (ctx) => ctx.conversation.enter('add-wallet'));
  bot.command('alerts', (ctx) => sendAlerts(ctx, deps));

  bot.command('cancel', async (ctx) => {
    const active = Object.keys(await ctx.conversation.active()).length > 0;
    await ctx.conversation.exitAll();
    await ctx.reply(t(ctx.user.locale, active ? 'cancelled' : 'nothingToCancel'));
  });

  bot.callbackQuery(/^lang:(uk|en)$/, async (ctx) => {
    const locale = (ctx.match[1] === 'en' ? 'en' : 'uk') as Locale;
    await prisma.user.update({ where: { id: ctx.user.id }, data: { locale } });
    ctx.user.locale = locale;
    await ctx.answerCallbackQuery();
    await ctx.reply(t(locale, 'languageSet'));
    await ctx.reply(t(locale, 'welcome'), { parse_mode: 'HTML', reply_markup: mainMenu });
  });

  bot.callbackQuery('alert:new', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter('create-alert');
  });

  bot.callbackQuery(/^alert:(p|r|d):(.+)$/, async (ctx) => {
    const [, action, alertId] = ctx.match;
    if (!action || !alertId) return;
    const locale = ctx.user.locale;

    let messageKey: 'alertPaused' | 'alertResumed' | 'alertDeleted';
    let changed: boolean;
    if (action === 'd') {
      changed = await deleteAlert(prisma, ctx.user.id, alertId);
      messageKey = 'alertDeleted';
    } else {
      changed = await setAlertStatus(
        prisma,
        ctx.user.id,
        alertId,
        action === 'p' ? 'PAUSED' : 'ACTIVE',
      );
      messageKey = action === 'p' ? 'alertPaused' : 'alertResumed';
    }
    await ctx.answerCallbackQuery(changed ? { text: t(locale, messageKey) } : undefined);

    const { text, keyboard } = await buildAlertsView(deps, ctx.user.id, locale);
    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
  });

  return bot;
}
