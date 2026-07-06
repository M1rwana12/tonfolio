import type { Locale } from '@tonfolio/shared';

const uk = {
  welcome:
    '👋 Вітаю! Я <b>TONFOLIO</b> — некастодіальний трекер портфеля на TON.\n\n' +
    '🔒 Read-only: я бачу лише публічні дані блокчейну, ваші ключі залишаються у вас.\n\n' +
    'Оберіть дію в меню нижче або скористайтесь командами:\n' +
    '/portfolio — зведення портфеля\n/add_wallet — додати гаманець\n/alerts — алерти',
  chooseLanguage: '🌐 Оберіть мову / Choose your language',
  languageSet: '✅ Мову встановлено: українська',
  menuPortfolio: '📊 Портфель',
  menuAddWallet: '➕ Гаманець',
  menuAlerts: '🔔 Алерти',
  menuLanguage: '🌐 Мова',
  portfolioTitle: '📊 <b>Ваш портфель</b>',
  portfolioTotal: 'Разом',
  portfolioChangeSuffix: 'за 24 год',
  portfolioEmpty: 'У вас поки немає гаманців.\nДодайте перший: /add_wallet',
  openMiniApp: '📱 Відкрити Mini App',
  addWalletPrompt:
    'Надішліть адресу TON-гаманця (<code>EQ…</code>, <code>UQ…</code> або raw <code>0:…</code>).\n\nСкасувати: /cancel',
  addWalletInvalid:
    '❌ Це не схоже на адресу TON. Перевірте та надішліть ще раз.\n\nСкасувати: /cancel',
  addWalletDuplicate: 'ℹ️ Цей гаманець уже додано.',
  addWalletLimit: '⚠️ Ліміт: до {limit} watch-only гаманців на користувача.',
  addWalletAdded:
    '✅ Гаманець додано:\n<code>{address}</code>\n\nЗнайдено активів: {assets}.\nДивіться /portfolio',
  cancelled: 'Скасовано.',
  nothingToCancel: 'Нема чого скасовувати.',
  alertsTitle: '🔔 <b>Ваші алерти</b>',
  alertsEmpty: 'У вас поки немає алертів.',
  alertsCreateButton: '➕ Створити алерт',
  alertLimit: '⚠️ Ліміт: до {limit} алертів на користувача.',
  alertChooseAsset: 'Оберіть актив:',
  alertChooseDirection: '<b>{symbol}</b>: сповістити, коли ціна…',
  alertAbove: '📈 вище порогу',
  alertBelow: '📉 нижче порогу',
  alertEnterPrice:
    'Введіть цінову позначку в USD (наприклад, <code>5.50</code>):\n\nСкасувати: /cancel',
  alertInvalidPrice: '❌ Некоректна ціна. Приклад: <code>5.50</code>\n\nСкасувати: /cancel',
  alertCreated: '✅ Алерт створено: {symbol} {direction} ${price}',
  aboveWord: 'вище',
  belowWord: 'нижче',
  alertPaused: '⏸ Алерт призупинено.',
  alertResumed: '▶️ Алерт увімкнено.',
  alertDeleted: '🗑 Алерт видалено.',
  errorGeneric: '😕 Щось пішло не так. Спробуйте ще раз.',
} as const;

const en: Record<MessageKey, string> = {
  welcome:
    '👋 Hi! I am <b>TONFOLIO</b> — a non-custodial TON portfolio tracker.\n\n' +
    '🔒 Read-only: I only see public blockchain data, your keys stay with you.\n\n' +
    'Pick an action from the menu below or use the commands:\n' +
    '/portfolio — portfolio summary\n/add_wallet — add a wallet\n/alerts — alerts',
  chooseLanguage: '🌐 Оберіть мову / Choose your language',
  languageSet: '✅ Language set: English',
  menuPortfolio: '📊 Portfolio',
  menuAddWallet: '➕ Wallet',
  menuAlerts: '🔔 Alerts',
  menuLanguage: '🌐 Language',
  portfolioTitle: '📊 <b>Your portfolio</b>',
  portfolioTotal: 'Total',
  portfolioChangeSuffix: '24h',
  portfolioEmpty: 'You have no wallets yet.\nAdd the first one: /add_wallet',
  openMiniApp: '📱 Open Mini App',
  addWalletPrompt:
    'Send a TON wallet address (<code>EQ…</code>, <code>UQ…</code> or raw <code>0:…</code>).\n\nCancel: /cancel',
  addWalletInvalid:
    "❌ That doesn't look like a TON address. Check it and try again.\n\nCancel: /cancel",
  addWalletDuplicate: 'ℹ️ This wallet is already added.',
  addWalletLimit: '⚠️ Limit: up to {limit} watch-only wallets per user.',
  addWalletAdded:
    '✅ Wallet added:\n<code>{address}</code>\n\nAssets found: {assets}.\nSee /portfolio',
  cancelled: 'Cancelled.',
  nothingToCancel: 'Nothing to cancel.',
  alertsTitle: '🔔 <b>Your alerts</b>',
  alertsEmpty: 'You have no alerts yet.',
  alertsCreateButton: '➕ Create alert',
  alertLimit: '⚠️ Limit: up to {limit} alerts per user.',
  alertChooseAsset: 'Choose an asset:',
  alertChooseDirection: '<b>{symbol}</b>: notify me when the price goes…',
  alertAbove: '📈 above a threshold',
  alertBelow: '📉 below a threshold',
  alertEnterPrice: 'Enter the price level in USD (e.g. <code>5.50</code>):\n\nCancel: /cancel',
  alertInvalidPrice: '❌ Invalid price. Example: <code>5.50</code>\n\nCancel: /cancel',
  alertCreated: '✅ Alert created: {symbol} {direction} ${price}',
  aboveWord: 'above',
  belowWord: 'below',
  alertPaused: '⏸ Alert paused.',
  alertResumed: '▶️ Alert resumed.',
  alertDeleted: '🗑 Alert deleted.',
  errorGeneric: '😕 Something went wrong. Please try again.',
};

export type MessageKey = keyof typeof uk;

const messages: Record<Locale, Record<MessageKey, string>> = { uk, en };

export function t(
  locale: Locale,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const template = messages[locale][key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}
