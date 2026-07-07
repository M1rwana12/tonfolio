'use client';

import { createContext, useContext } from 'react';

export type Locale = 'uk' | 'en';

const uk = {
  navPortfolio: 'Портфель',
  navAssets: 'Активи',
  navHistory: 'Історія',
  navAlerts: 'Алерти',
  totalValue: 'Вартість портфеля',
  change24h: 'за 24 год',
  allocation: 'Розподіл активів',
  history30d: 'Динаміка за 30 днів',
  other: 'Інше',
  wallets: 'Гаманці',
  verified: 'Підтверджено',
  watchOnly: 'Watch-only',
  emptyPortfolio:
    'Поки що порожньо. Підключіть гаманець через TON Connect або додайте watch-only адресу в боті.',
  assetsTitle: 'Активи',
  price24h: '24г',
  txTitle: 'Історія транзакцій',
  txEmpty: 'Транзакцій не знайдено.',
  txIn: 'Вхідна',
  loadMore: 'Показати ще',
  chooseWallet: 'Гаманець',
  alertsTitle: 'Алерти',
  alertsEmpty: 'Алертів поки немає.',
  createAlert: 'Створити алерт',
  alertType: 'Тип алерту',
  typePriceAbove: 'Ціна вище порогу',
  typePriceBelow: 'Ціна нижче порогу',
  typePriceChange: 'Зміна ціни за період',
  typeWalletTx: 'Будь-яка транзакція гаманця',
  typeLargeTransfer: 'Великий переказ',
  fieldAsset: 'Актив',
  fieldWallet: 'Гаманець',
  fieldPrice: 'Ціна, USD',
  fieldThreshold: 'Поріг, %',
  fieldWindow: 'Вікно, хвилин',
  fieldMinAmount: 'Мін. сума, TON',
  save: 'Створити',
  cancel: 'Скасувати',
  statusActive: 'Активний',
  statusPaused: 'Пауза',
  statusTriggered: 'Спрацював',
  pause: 'Пауза',
  resume: 'Увімкнути',
  remove: 'Видалити',
  connectHint:
    'Підключення через TON Connect — лише підтвердження володіння адресою. Ключі залишаються у вас.',
  loading: 'Завантаження…',
  error: 'Не вдалося завантажити дані',
  retry: 'Спробувати ще раз',
} as const;

export type MessageKey = keyof typeof uk;

const en: Record<MessageKey, string> = {
  navPortfolio: 'Portfolio',
  navAssets: 'Assets',
  navHistory: 'History',
  navAlerts: 'Alerts',
  totalValue: 'Portfolio value',
  change24h: '24h',
  allocation: 'Allocation',
  history30d: '30-day history',
  other: 'Other',
  wallets: 'Wallets',
  verified: 'Verified',
  watchOnly: 'Watch-only',
  emptyPortfolio:
    'Nothing here yet. Connect a wallet via TON Connect or add a watch-only address in the bot.',
  assetsTitle: 'Assets',
  price24h: '24h',
  txTitle: 'Transaction history',
  txEmpty: 'No transactions found.',
  txIn: 'Incoming',
  loadMore: 'Load more',
  chooseWallet: 'Wallet',
  alertsTitle: 'Alerts',
  alertsEmpty: 'No alerts yet.',
  createAlert: 'Create alert',
  alertType: 'Alert type',
  typePriceAbove: 'Price above threshold',
  typePriceBelow: 'Price below threshold',
  typePriceChange: 'Price change over a window',
  typeWalletTx: 'Any wallet transaction',
  typeLargeTransfer: 'Large transfer',
  fieldAsset: 'Asset',
  fieldWallet: 'Wallet',
  fieldPrice: 'Price, USD',
  fieldThreshold: 'Threshold, %',
  fieldWindow: 'Window, minutes',
  fieldMinAmount: 'Min amount, TON',
  save: 'Create',
  cancel: 'Cancel',
  statusActive: 'Active',
  statusPaused: 'Paused',
  statusTriggered: 'Triggered',
  pause: 'Pause',
  resume: 'Resume',
  remove: 'Delete',
  connectHint: 'TON Connect is used only as proof of ownership. Your keys stay with you.',
  loading: 'Loading…',
  error: 'Failed to load data',
  retry: 'Retry',
};

const messages: Record<Locale, Record<MessageKey, string>> = { uk, en };

export const LocaleContext = createContext<Locale>('uk');

export function useT(): (key: MessageKey) => string {
  const locale = useContext(LocaleContext);
  return (key) => messages[locale][key];
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}
