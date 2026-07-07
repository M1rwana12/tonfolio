import { SlidingWindowCounter } from '@tonfolio/shared';
import type { MiddlewareFn } from 'grammy';

import type { BotContext } from './context.js';
import { THROTTLE_WARNING } from './i18n.js';

const WINDOW_MS = 60_000;

/**
 * Per-user update throttle. Sits before the DB middleware so a spamming chat
 * cannot generate load; the warning is sent at most once per window, the rest
 * is dropped silently. Updates without a sender cannot be attributed and pass
 * through untouched.
 */
export function throttle(limit = 20): MiddlewareFn<BotContext> {
  const counter = new SlidingWindowCounter(limit, WINDOW_MS);
  const warnedAt = new Map<number, number>();

  return async (ctx, next) => {
    const from = ctx.from;
    if (!from) return next();

    const now = Date.now();
    if (counter.hit(String(from.id), now).allowed) {
      return next();
    }

    // keep the client responsive: a dropped callback must not spin forever
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery().catch(() => undefined);
    }
    const lastWarn = warnedAt.get(from.id) ?? 0;
    if (now - lastWarn > WINDOW_MS) {
      warnedAt.set(from.id, now);
      if (warnedAt.size > 10_000) warnedAt.clear();
      await ctx.reply(THROTTLE_WARNING);
    }
  };
}
