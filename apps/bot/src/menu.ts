import { Menu } from '@grammyjs/menu';

import type { BotContext, BotDeps } from './context.js';
import { sendAlerts, sendLanguageChooser, sendPortfolio } from './handlers.js';
import { t } from './i18n.js';

export function createMainMenu(deps: BotDeps): Menu<BotContext> {
  return new Menu<BotContext>('main')
    .text(
      (ctx) => t(ctx.user.locale, 'menuPortfolio'),
      (ctx) => sendPortfolio(ctx, deps),
    )
    .text(
      (ctx) => t(ctx.user.locale, 'menuAddWallet'),
      (ctx) => ctx.conversation.enter('add-wallet'),
    )
    .row()
    .text(
      (ctx) => t(ctx.user.locale, 'menuAlerts'),
      (ctx) => sendAlerts(ctx, deps),
    )
    .text(
      (ctx) => t(ctx.user.locale, 'menuLanguage'),
      (ctx) => sendLanguageChooser(ctx),
    );
}
