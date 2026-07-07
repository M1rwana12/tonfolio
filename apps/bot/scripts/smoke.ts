/**
 * End-to-end smoke test for the bot: feeds real Telegram updates through
 * bot.handleUpdate() with outgoing API calls intercepted, so every handler,
 * conversation, DB query and tonapi/CoinGecko call runs for real while
 * nothing is sent to Telegram.
 */
import { getPrisma } from '@tonfolio/db';
import { CoinGeckoClient, TonApiClient } from '@tonfolio/ton';
import type { InlineKeyboardButton, Update, UserFromGetMe } from 'grammy/types';

import { createBot } from '../src/bot.js';
import type { CreateBotOptions } from '../src/bot.js';
import type { BotDeps } from '../src/context.js';
import { loadEnv } from '../src/env.js';
import { PriceService } from '@tonfolio/core';

const TEST_TG_ID = 999_000_111;
const FOUNDATION = 'EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N';

const botInfo: UserFromGetMe = {
  id: 1,
  is_bot: true,
  first_name: 'TONFOLIO',
  username: 'tonfolio_app_bot',
  can_join_groups: true,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business: false,
  has_main_web_app: false,
  has_topics_enabled: false,
  allows_users_to_create_topics: false,
  can_manage_bots: false,
  supports_join_request_queries: false,
};

let updateId = 1;
let messageId = 1000;
let lastKeyboard: InlineKeyboardButton[][] = [];
const transcript: string[] = [];
let failures = 0;

function messageUpdate(text: string): Update {
  const entities = text.startsWith('/')
    ? [{ type: 'bot_command' as const, offset: 0, length: text.split(' ')[0]?.length ?? 0 }]
    : [];
  return {
    update_id: updateId++,
    message: {
      message_id: messageId++,
      date: Math.floor(Date.now() / 1000),
      chat: { id: TEST_TG_ID, type: 'private', first_name: 'Smoke' },
      from: { id: TEST_TG_ID, is_bot: false, first_name: 'Smoke' },
      text,
      entities,
    },
  };
}

function callbackUpdate(data: string): Update {
  return {
    update_id: updateId++,
    callback_query: {
      id: String(updateId),
      chat_instance: 'smoke',
      from: { id: TEST_TG_ID, is_bot: false, first_name: 'Smoke' },
      data,
      message: {
        message_id: messageId++,
        date: Math.floor(Date.now() / 1000),
        chat: { id: TEST_TG_ID, type: 'private', first_name: 'Smoke' },
        text: 'previous message',
      },
    },
  };
}

function findButton(prefix: string): string {
  for (const row of lastKeyboard) {
    for (const button of row) {
      const data = 'callback_data' in button ? button.callback_data : undefined;
      if (data?.startsWith(prefix)) return data;
    }
  }
  throw new Error(`no button with prefix "${prefix}" in the last keyboard`);
}

function expectContains(step: string, needle: string): void {
  const recent = transcript.slice(-3).join('\n');
  if (recent.includes(needle)) {
    console.log(`  ✅ ${step}`);
  } else {
    failures += 1;
    console.error(`  ❌ ${step}: expected «${needle}» in:\n${recent}`);
  }
}

async function main(): Promise<void> {
  const env = loadEnv();
  const prisma = getPrisma();
  const tonapi = new TonApiClient(env.TONAPI_KEY ? { apiKey: env.TONAPI_KEY } : {});
  const coingecko = new CoinGeckoClient(
    env.COINGECKO_API_KEY ? { apiKey: env.COINGECKO_API_KEY } : {},
  );
  const deps: BotDeps = { prisma, tonapi, prices: new PriceService(prisma, coingecko), env };

  // fresh test user every run
  await prisma.user.deleteMany({ where: { telegramId: BigInt(TEST_TG_ID) } });

  // Fake Bot API transport: grammY (and the conversation-internal Api
  // instances, which inherit client options) talk to this instead of Telegram.
  const mockTelegramFetch = async (
    input: string | URL,
    init?: { body?: unknown },
  ): Promise<Response> => {
    const url = String(input);
    const method = url.split('/').pop() ?? '';
    let payload: Record<string, unknown> = {};
    if (typeof init?.body === 'string') {
      try {
        payload = JSON.parse(init.body) as Record<string, unknown>;
      } catch {
        /* non-JSON body — keep payload empty */
      }
    }
    if (method === 'sendMessage' || method === 'editMessageText') {
      const text = String(payload.text ?? '');
      transcript.push(text);
      console.log(`  [bot → user] ${text.replaceAll('\n', ' | ').slice(0, 160)}`);
      const markup = payload.reply_markup as
        { inline_keyboard?: InlineKeyboardButton[][] } | undefined;
      if (markup?.inline_keyboard) lastKeyboard = markup.inline_keyboard;
    }
    let result: unknown = true;
    if (method === 'sendMessage') {
      result = {
        message_id: messageId++,
        date: Math.floor(Date.now() / 1000),
        chat: { id: TEST_TG_ID, type: 'private', first_name: 'Smoke' },
        text: String(payload.text ?? ''),
      };
    } else if (method === 'getMe') {
      result = botInfo;
    }
    return new Response(JSON.stringify({ ok: true, result }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const bot = createBot(deps, {
    botInfo,
    clientFetch: mockTelegramFetch as unknown as CreateBotOptions['clientFetch'],
    throttleLimit: 1_000,
  });

  console.log('\n— /start (новый пользователь)');
  await bot.handleUpdate(messageUpdate('/start'));
  expectContains('предлагает выбрать язык', 'Оберіть мову');

  console.log('\n— выбор языка: українська');
  await bot.handleUpdate(callbackUpdate('lang:uk'));
  expectContains('язык установлен + приветствие', 'некастодіальний');

  console.log('\n— /portfolio без кошельков');
  await bot.handleUpdate(messageUpdate('/portfolio'));
  expectContains('пустое состояние', 'немає гаманців');

  console.log('\n— /add_wallet: мусорный адрес');
  await bot.handleUpdate(messageUpdate('/add_wallet'));
  await bot.handleUpdate(messageUpdate('это не адрес'));
  expectContains('отклоняет невалидный адрес', 'не схоже на адресу');

  console.log('\n— /add_wallet: реальный mainnet-адрес (tonapi live)');
  await bot.handleUpdate(messageUpdate(FOUNDATION));
  expectContains('кошелёк добавлен', 'Гаманець додано');

  console.log('\n— повторное добавление того же адреса');
  await bot.handleUpdate(messageUpdate('/add_wallet'));
  await bot.handleUpdate(messageUpdate(FOUNDATION));
  expectContains('дубликат отклонён', 'уже додано');

  console.log('\n— /portfolio с живыми балансами и ценами');
  await bot.handleUpdate(messageUpdate('/portfolio'));
  expectContains('сводка с TON', 'TON');
  expectContains('итог в USD', 'Разом');

  console.log('\n— /alerts: создание ценового алерта');
  await bot.handleUpdate(messageUpdate('/alerts'));
  expectContains('пустой список алертов', 'немає алертів');
  await bot.handleUpdate(callbackUpdate('alert:new'));
  expectContains('выбор актива', 'Оберіть актив');
  await bot.handleUpdate(callbackUpdate(findButton('ca:')));
  expectContains('выбор направления', 'сповістити, коли ціна');
  await bot.handleUpdate(callbackUpdate('cd:above'));
  expectContains('запрос цены', 'цінову позначку');
  await bot.handleUpdate(messageUpdate('не число'));
  expectContains('отклоняет невалидную цену', 'Некоректна ціна');
  await bot.handleUpdate(messageUpdate('3.10'));
  expectContains('алерт создан', 'Алерт створено');

  console.log('\n— /alerts: пауза и удаление');
  await bot.handleUpdate(messageUpdate('/alerts'));
  expectContains('алерт в списке', '≥ $3.1');
  await bot.handleUpdate(callbackUpdate(findButton('alert:p:')));
  expectContains('алерт на паузе (⏸ в списке)', '⏸');
  await bot.handleUpdate(callbackUpdate(findButton('alert:d:')));
  expectContains('список снова пуст', 'немає алертів');

  console.log('\n— /cancel вне диалога');
  await bot.handleUpdate(messageUpdate('/cancel'));
  expectContains('нечего отменять', 'Нема чого скасовувати');

  // cleanup test data
  await prisma.user.deleteMany({ where: { telegramId: BigInt(TEST_TG_ID) } });
  await prisma.$disconnect();

  console.log(`\n${failures === 0 ? '✅ SMOKE PASSED' : `❌ SMOKE FAILED: ${failures} step(s)`}`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
