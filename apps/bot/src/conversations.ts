import type { Conversation } from '@grammyjs/conversations';
import type { User } from '@tonfolio/db';
import {
  FIAT_DECIMALS,
  MAX_ALERTS_PER_USER,
  MAX_WATCH_ONLY_WALLETS,
  formatUnits,
  parseUnits,
} from '@tonfolio/shared';
import { parseTonAddress } from '@tonfolio/ton';
import type { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';

import type { BotContext, BotDeps } from './context.js';
import { t } from './i18n.js';
import { createPriceAlert } from './services/alerts.js';
import { addWatchWallet } from './services/wallets.js';

type Convo = Conversation<BotContext, Context>;

async function loadUser(conversation: Convo, ctx: Context, deps: BotDeps): Promise<User | null> {
  const telegramId = ctx.from?.id;
  if (telegramId === undefined) return null;
  return conversation.external(() =>
    deps.prisma.user.findUnique({ where: { telegramId: BigInt(telegramId) } }),
  );
}

function isCancel(text: string): boolean {
  return text.trim().startsWith('/cancel');
}

export function addWalletConversation(deps: BotDeps) {
  return async (conversation: Convo, ctx: Context): Promise<void> => {
    const user = await loadUser(conversation, ctx, deps);
    if (!user) return;
    const locale = user.locale;

    await ctx.reply(t(locale, 'addWalletPrompt'), { parse_mode: 'HTML' });

    for (;;) {
      const messageCtx = await conversation.waitFor('message:text');
      const text = messageCtx.message.text;
      if (isCancel(text)) {
        await messageCtx.reply(t(locale, 'cancelled'));
        return;
      }

      const address = parseTonAddress(text);
      if (!address) {
        await messageCtx.reply(t(locale, 'addWalletInvalid'), { parse_mode: 'HTML' });
        continue;
      }

      const result = await conversation.external(() =>
        addWatchWallet(deps.prisma, deps.tonapi, user.id, address),
      );
      if (!result.ok) {
        const key = result.reason === 'duplicate' ? 'addWalletDuplicate' : 'addWalletLimit';
        await messageCtx.reply(t(locale, key, { limit: MAX_WATCH_ONLY_WALLETS }));
        return;
      }

      await messageCtx.reply(
        t(locale, 'addWalletAdded', { address: address.friendly, assets: result.assets }),
        { parse_mode: 'HTML' },
      );
      return;
    }
  };
}

export function createAlertConversation(deps: BotDeps) {
  return async (conversation: Convo, ctx: Context): Promise<void> => {
    const user = await loadUser(conversation, ctx, deps);
    if (!user) return;
    const locale = user.locale;

    const alertCount = await conversation.external(() =>
      deps.prisma.alert.count({ where: { userId: user.id } }),
    );
    if (alertCount >= MAX_ALERTS_PER_USER) {
      await ctx.reply(t(locale, 'alertLimit', { limit: MAX_ALERTS_PER_USER }));
      return;
    }

    const assets = await conversation.external(() =>
      deps.prisma.asset.findMany({
        where: { coingeckoId: { not: null } },
        orderBy: { symbol: 'asc' },
        select: { id: true, symbol: true },
      }),
    );

    const assetKeyboard = new InlineKeyboard();
    assets.forEach((asset, index) => {
      assetKeyboard.text(asset.symbol, `ca:${asset.id}`);
      if (index % 3 === 2) assetKeyboard.row();
    });
    await ctx.reply(t(locale, 'alertChooseAsset'), { reply_markup: assetKeyboard });

    const assetCtx = await conversation.waitForCallbackQuery(/^ca:(.+)$/);
    await assetCtx.answerCallbackQuery();
    const assetId = assetCtx.callbackQuery.data.slice(3);
    const symbol = assets.find((asset) => asset.id === assetId)?.symbol ?? '?';

    const directionKeyboard = new InlineKeyboard()
      .text(t(locale, 'alertAbove'), 'cd:above')
      .row()
      .text(t(locale, 'alertBelow'), 'cd:below');
    await assetCtx.reply(t(locale, 'alertChooseDirection', { symbol }), {
      parse_mode: 'HTML',
      reply_markup: directionKeyboard,
    });

    const directionCtx = await conversation.waitForCallbackQuery(/^cd:(above|below)$/);
    await directionCtx.answerCallbackQuery();
    const direction = directionCtx.callbackQuery.data === 'cd:above' ? 'above' : 'below';

    await directionCtx.reply(t(locale, 'alertEnterPrice'), { parse_mode: 'HTML' });

    for (;;) {
      const priceCtx = await conversation.waitFor('message:text');
      const text = priceCtx.message.text;
      if (isCancel(text)) {
        await priceCtx.reply(t(locale, 'cancelled'));
        return;
      }

      let priceUsd: bigint;
      try {
        priceUsd = parseUnits(text.trim().replace(',', '.'), FIAT_DECIMALS);
      } catch {
        await priceCtx.reply(t(locale, 'alertInvalidPrice'), { parse_mode: 'HTML' });
        continue;
      }
      if (priceUsd <= 0n) {
        await priceCtx.reply(t(locale, 'alertInvalidPrice'), { parse_mode: 'HTML' });
        continue;
      }

      const result = await conversation.external(() =>
        createPriceAlert(deps.prisma, user.id, { assetId, direction, priceUsd }),
      );
      if (!result.ok) {
        await priceCtx.reply(t(locale, 'alertLimit', { limit: MAX_ALERTS_PER_USER }));
        return;
      }

      await priceCtx.reply(
        t(locale, 'alertCreated', {
          symbol,
          direction: t(locale, direction === 'above' ? 'aboveWord' : 'belowWord'),
          price: formatUnits(priceUsd, FIAT_DECIMALS, { maxFraction: 4 }),
        }),
      );
      return;
    }
  };
}
