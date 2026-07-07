import { parse, validate } from '@telegram-apps/init-data-node';
import type { User } from '@tonfolio/db';

import { serverEnv } from './env';
import { ApiError } from './http';
import { services } from './services';

const INIT_DATA_TTL_SEC = 3600;

async function upsertUser(telegramId: bigint, languageCode?: string): Promise<User> {
  const { prisma } = services();
  const existing = await prisma.user.findUnique({ where: { telegramId } });
  if (existing) return existing;
  return prisma.user.create({
    data: { telegramId, locale: languageCode === 'en' ? 'en' : 'uk' },
  });
}

/**
 * Every API request must carry `Authorization: tma <initDataRaw>`; the HMAC is
 * checked against the bot token. A header-based dev bypass exists only behind
 * ALLOW_DEV_AUTH=1 for local development and e2e runs.
 */
export async function authenticate(req: Request): Promise<User> {
  const env = serverEnv();
  const header = req.headers.get('authorization') ?? '';

  if (header.startsWith('tma ')) {
    const raw = header.slice(4).trim();
    try {
      validate(raw, env.BOT_TOKEN, { expiresIn: INIT_DATA_TTL_SEC });
    } catch {
      throw new ApiError(401, 'invalid init data');
    }
    const initData = parse(raw);
    const tgUser = initData.user;
    if (!tgUser) throw new ApiError(401, 'init data has no user');
    return upsertUser(BigInt(tgUser.id), tgUser.language_code);
  }

  if (env.ALLOW_DEV_AUTH === '1') {
    const devId = req.headers.get('x-dev-telegram-id');
    if (devId && /^\d+$/.test(devId)) {
      return upsertUser(BigInt(devId));
    }
  }

  throw new ApiError(401, 'unauthorized');
}
