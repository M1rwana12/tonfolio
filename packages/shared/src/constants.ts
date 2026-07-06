export const TON_DECIMALS = 9;

/** Fixed-point scale for fiat prices and portfolio values (USD/UAH). */
export const FIAT_DECIMALS = 9;

export const MAX_WATCH_ONLY_WALLETS = 5;
export const MAX_ALERTS_PER_USER = 20;
export const DEFAULT_ALERT_COOLDOWN_SEC = 3600;
export const PRICE_CACHE_TTL_SEC = 60;

export const SUPPORTED_LOCALES = ['uk', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'uk';
