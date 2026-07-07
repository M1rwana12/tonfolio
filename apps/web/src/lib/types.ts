export interface ApiPosition {
  assetId: string;
  symbol: string;
  name: string;
  amount: string;
  decimals: number;
  valueUsd: string;
  valueUah: string;
  change24Bps: string | null;
}

export interface ApiSummary {
  totalUsd: string;
  totalUah: string;
  change24Bps: string | null;
  positions: ApiPosition[];
}

export interface ApiWallet {
  id: string;
  addressFriendly: string;
  label: string | null;
  verified: boolean;
  isWatchOnly: boolean;
}

export interface PortfolioResponse {
  locale: 'uk' | 'en';
  summary: ApiSummary | null;
  wallets: ApiWallet[];
  history: Array<{ t: number; usd: string }>;
}

export type AlertType =
  'PRICE_ABOVE' | 'PRICE_BELOW' | 'PRICE_CHANGE_PCT' | 'WALLET_TX' | 'LARGE_TRANSFER';

export type AlertStatus = 'ACTIVE' | 'TRIGGERED' | 'PAUSED';

export interface ApiAlert {
  id: string;
  type: AlertType;
  status: AlertStatus;
  params: Record<string, unknown>;
  createdAt: string;
}

export interface AlertsResponse {
  alerts: ApiAlert[];
  assets: Array<{ id: string; symbol: string; name: string }>;
  wallets: Array<{ id: string; addressFriendly: string; label: string | null }>;
}

export interface ApiTransaction {
  hash: string;
  lt: string;
  utime: number;
  success: boolean;
  valueIn: string;
}

export interface TransactionsResponse {
  items: ApiTransaction[];
  nextBeforeLt: string | null;
}
