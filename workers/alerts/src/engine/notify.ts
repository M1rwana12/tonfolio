import { FIAT_DECIMALS, TON_DECIMALS, formatUnits } from '@tonfolio/shared';
import { Api, InlineKeyboard } from 'grammy';

type Locale = 'uk' | 'en';

const texts = {
  uk: {
    above: 'вище',
    below: 'нижче',
    change: 'змінилась на',
    currentPrice: 'Поточна ціна',
    newTx: 'нова транзакція',
    newTxLarge: 'великий переказ',
    incoming: 'вхідні',
    pause: '⏸ Пауза',
    remove: '🗑 Видалити',
    open: 'Відкрити у tonviewer',
  },
  en: {
    above: 'above',
    below: 'below',
    change: 'changed by',
    currentPrice: 'Current price',
    newTx: 'new transaction',
    newTxLarge: 'large transfer',
    incoming: 'incoming',
    pause: '⏸ Pause',
    remove: '🗑 Delete',
    open: 'Open in tonviewer',
  },
} satisfies Record<Locale, Record<string, string>>;

export function buildPriceAlertMessage(
  locale: Locale,
  symbol: string,
  kind: 'above' | 'below' | 'change',
  thresholdText: string,
  currentPrice: bigint,
): string {
  const t = texts[locale];
  const current = formatUnits(currentPrice, FIAT_DECIMALS, { maxFraction: 4 });
  const condition =
    kind === 'change' ? `${t.change} ${thresholdText}` : `${t[kind]} $${thresholdText}`;
  return `🔔 <b>${symbol}</b> ${condition}\n${t.currentPrice}: $${current}`;
}

export function buildTxAlertMessage(
  locale: Locale,
  walletLabel: string,
  kind: 'tx' | 'large',
  valueIn: bigint,
  hash: string,
): string {
  const t = texts[locale];
  const amount =
    valueIn > 0n
      ? ` (${t.incoming} ${formatUnits(valueIn, TON_DECIMALS, { maxFraction: 4, group: true })} TON)`
      : '';
  const link = `<a href="https://tonviewer.com/transaction/${hash}">${t.open}</a>`;
  return `👛 <b>${walletLabel}</b>: ${kind === 'large' ? t.newTxLarge : t.newTx}${amount}\n${link}`;
}

/** Delivery contract — a console fake in demos/tests, Bot API in production. */
export interface AlertSender {
  send(telegramId: bigint, locale: Locale, text: string, alertId: string): Promise<void>;
}

export function telegramAlertSender(botToken: string): AlertSender {
  const api = new Api(botToken);
  return {
    async send(telegramId, locale, text, alertId) {
      const t = texts[locale];
      const keyboard = new InlineKeyboard()
        .text(t.pause, `alert:p:${alertId}`)
        .text(t.remove, `alert:d:${alertId}`);
      await api.sendMessage(Number(telegramId), text, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        reply_markup: keyboard,
      });
    },
  };
}
