import { conversations, createConversation } from '@grammyjs/conversations';
import { getPrisma } from '@tonfolio/db';
import type { Locale } from '@tonfolio/shared';
import { CoinGeckoClient, TonApiClient } from '@tonfolio/ton';
import { Bot } from 'grammy';

import type { BaseContext, BotContext, BotDeps } from './context.js';
import { addWalletConversation, createAlertConversation } from './conversations.js';
import { loadEnv } from './env.js';
import { buildAlertsView, sendAlerts, sendLanguageChooser, sendPortfolio } from './handlers.js';
import { t } from './i18n.js';
import { createMainMenu } from './menu.js';
import { deleteAlert, setAlertStatus } from './services/alerts.js';
import { PriceService } from './services/prices.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const prisma = getPrisma();
  const tonapi = new TonApiClient(env.TONAPI_KEY ? { apiKey: env.TONAPI_KEY } : {});
  const coingecko = new CoinGeckoClient(
    env.COINGECKO_API_KEY ? { apiKey: env.COINGECKO_API_KEY } : {},
  );
  const deps: BotDeps = { prisma, tonapi, prices: new PriceService(prisma, coingecko), env };

  const bot = new Bot<BotContext>(env.BOT_TOKEN);

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

  await bot.api.setMyCommands([
    { command: 'portfolio', description: 'Зведення портфеля' },
    { command: 'add_wallet', description: 'Додати гаманець' },
    { command: 'alerts', description: 'Алерти' },
    { command: 'language', description: 'Мова / Language' },
    { command: 'cancel', description: 'Скасувати діалог' },
  ]);
  await bot.api.setMyCommands(
    [
      { command: 'portfolio', description: 'Portfolio summary' },
      { command: 'add_wallet', description: 'Add a wallet' },
      { command: 'alerts', description: 'Alerts' },
      { command: 'language', description: 'Language' },
      { command: 'cancel', description: 'Cancel the dialog' },
    ],
    { language_code: 'en' },
  );

  await bot.start({
    drop_pending_updates: true,
    onStart: (me) => console.log(`[bot] @${me.username} is polling`),
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
