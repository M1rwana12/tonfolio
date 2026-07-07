import type { ConversationFlavor } from '@grammyjs/conversations';
import type { PrismaClient, User } from '@tonfolio/db';
import type { TonApiClient } from '@tonfolio/ton';
import type { Context } from 'grammy';

import type { Env } from './env.js';
import type { PriceService } from '@tonfolio/core';

export type BaseContext = Context & {
  /** Upserted DB user for the incoming update. */
  user: User;
  /** True when this update created the user (first contact). */
  userCreated: boolean;
};

export type BotContext = ConversationFlavor<BaseContext>;

export interface BotDeps {
  prisma: PrismaClient;
  tonapi: TonApiClient;
  prices: PriceService;
  env: Env;
}
