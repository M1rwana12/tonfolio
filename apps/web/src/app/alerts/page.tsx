'use client';

import { FIAT_DECIMALS, TON_DECIMALS, formatUnits, parseUnits } from '@tonfolio/shared';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { shortAddress } from '@/lib/format';
import { tapHaptic } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import type { AlertsResponse, AlertType, ApiAlert } from '@/lib/types';
import { useApi } from '@/lib/use-api';
import { cn } from '@/lib/utils';

const TYPE_KEYS = {
  PRICE_ABOVE: 'typePriceAbove',
  PRICE_BELOW: 'typePriceBelow',
  PRICE_CHANGE_PCT: 'typePriceChange',
  WALLET_TX: 'typeWalletTx',
  LARGE_TRANSFER: 'typeLargeTransfer',
} as const;

const STATUS_ICON = { ACTIVE: '🟢', PAUSED: '⏸', TRIGGERED: '✅' } as const;

function describeAlert(alert: ApiAlert, data: AlertsResponse): string {
  const params = alert.params;
  const symbol = data.assets.find((asset) => asset.id === params.assetId)?.symbol ?? '?';
  const wallet = data.wallets.find((w) => w.id === params.walletId);
  const walletLabel = wallet ? (wallet.label ?? shortAddress(wallet.addressFriendly)) : '?';
  switch (alert.type) {
    case 'PRICE_ABOVE':
    case 'PRICE_BELOW': {
      const price = formatUnits(BigInt(String(params.priceUsd ?? '0')), FIAT_DECIMALS, {
        maxFraction: 4,
      });
      return `${symbol} ${alert.type === 'PRICE_ABOVE' ? '≥' : '≤'} $${price}`;
    }
    case 'PRICE_CHANGE_PCT':
      return `${symbol} ±${Number(params.thresholdBps ?? 0) / 100}% / ${String(params.windowMinutes)}м`;
    case 'WALLET_TX':
      return `TX: ${walletLabel}`;
    case 'LARGE_TRANSFER': {
      const min = formatUnits(BigInt(String(params.minAmount ?? '0')), TON_DECIMALS, {
        maxFraction: 2,
        group: true,
      });
      return `≥ ${min} TON: ${walletLabel}`;
    }
  }
}

const inputClass =
  'h-11 w-full rounded-xl bg-card px-3 text-sm text-foreground outline-none placeholder:text-hint';

export default function AlertsPage() {
  const t = useT();
  const { data, loading, error, reload } = useApi<AlertsResponse>('/api/alerts');

  const [formOpen, setFormOpen] = useState(false);
  const [type, setType] = useState<AlertType>('PRICE_ABOVE');
  const [assetId, setAssetId] = useState('');
  const [walletId, setWalletId] = useState('');
  const [price, setPrice] = useState('');
  const [threshold, setThreshold] = useState('5');
  const [windowMinutes, setWindowMinutes] = useState('60');
  const [minAmount, setMinAmount] = useState('100');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const needsAsset =
    type === 'PRICE_ABOVE' || type === 'PRICE_BELOW' || type === 'PRICE_CHANGE_PCT';
  const needsWallet = type === 'WALLET_TX' || type === 'LARGE_TRANSFER';

  async function submit(): Promise<void> {
    if (!data) return;
    setFormError(null);
    setSubmitting(true);
    try {
      const asset = assetId || (data.assets[0]?.id ?? '');
      const wallet = walletId || (data.wallets[0]?.id ?? '');
      let params: Record<string, unknown>;
      switch (type) {
        case 'PRICE_ABOVE':
        case 'PRICE_BELOW':
          params = {
            type,
            assetId: asset,
            priceUsd: parseUnits(price.replace(',', '.'), FIAT_DECIMALS).toString(),
          };
          break;
        case 'PRICE_CHANGE_PCT':
          params = {
            type,
            assetId: asset,
            thresholdBps: Math.round(Number(threshold.replace(',', '.')) * 100),
            windowMinutes: Number(windowMinutes),
          };
          break;
        case 'WALLET_TX':
          params = { type, walletId: wallet };
          break;
        case 'LARGE_TRANSFER':
          params = {
            type,
            walletId: wallet,
            minAmount: parseUnits(minAmount.replace(',', '.'), TON_DECIMALS).toString(),
          };
          break;
      }
      await api('/api/alerts', { method: 'POST', body: JSON.stringify({ params }) });
      tapHaptic();
      setFormOpen(false);
      setPrice('');
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function setStatus(alert: ApiAlert): Promise<void> {
    tapHaptic();
    await api(`/api/alerts/${alert.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: alert.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED' }),
    });
    reload();
  }

  async function remove(alert: ApiAlert): Promise<void> {
    tapHaptic();
    await api(`/api/alerts/${alert.id}`, { method: 'DELETE' });
    reload();
  }

  if (loading && !data) {
    return (
      <div className="flex flex-col gap-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  }
  if (error) return <Card className="text-sm text-negative">{t('error')}</Card>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">{t('alertsTitle')}</h1>
        <Button size="sm" data-testid="alert-create-open" onClick={() => setFormOpen((v) => !v)}>
          {formOpen ? t('cancel') : `+ ${t('createAlert')}`}
        </Button>
      </div>

      {formOpen && data && (
        <Card className="flex flex-col gap-3" data-testid="alert-form">
          <label className="flex flex-col gap-1 text-xs text-hint">
            {t('alertType')}
            <select
              className={inputClass}
              value={type}
              onChange={(e) => setType(e.target.value as AlertType)}
              data-testid="alert-type"
            >
              {(Object.keys(TYPE_KEYS) as AlertType[]).map((key) => (
                <option key={key} value={key}>
                  {t(TYPE_KEYS[key])}
                </option>
              ))}
            </select>
          </label>

          {needsAsset && (
            <label className="flex flex-col gap-1 text-xs text-hint">
              {t('fieldAsset')}
              <select
                className={inputClass}
                value={assetId || (data.assets[0]?.id ?? '')}
                onChange={(e) => setAssetId(e.target.value)}
                data-testid="alert-asset"
              >
                {data.assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.symbol} — {asset.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {needsWallet && (
            <label className="flex flex-col gap-1 text-xs text-hint">
              {t('fieldWallet')}
              <select
                className={inputClass}
                value={walletId || (data.wallets[0]?.id ?? '')}
                onChange={(e) => setWalletId(e.target.value)}
              >
                {data.wallets.map((wallet) => (
                  <option key={wallet.id} value={wallet.id}>
                    {wallet.label ?? shortAddress(wallet.addressFriendly)}
                  </option>
                ))}
              </select>
            </label>
          )}

          {(type === 'PRICE_ABOVE' || type === 'PRICE_BELOW') && (
            <label className="flex flex-col gap-1 text-xs text-hint">
              {t('fieldPrice')}
              <input
                className={inputClass}
                inputMode="decimal"
                placeholder="5.50"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                data-testid="alert-price"
              />
            </label>
          )}

          {type === 'PRICE_CHANGE_PCT' && (
            <div className="flex gap-2">
              <label className="flex flex-1 flex-col gap-1 text-xs text-hint">
                {t('fieldThreshold')}
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                />
              </label>
              <label className="flex flex-1 flex-col gap-1 text-xs text-hint">
                {t('fieldWindow')}
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={windowMinutes}
                  onChange={(e) => setWindowMinutes(e.target.value)}
                />
              </label>
            </div>
          )}

          {type === 'LARGE_TRANSFER' && (
            <label className="flex flex-col gap-1 text-xs text-hint">
              {t('fieldMinAmount')}
              <input
                className={inputClass}
                inputMode="decimal"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
              />
            </label>
          )}

          {formError && <p className="text-xs text-negative">{formError}</p>}
          <Button onClick={() => void submit()} disabled={submitting} data-testid="alert-submit">
            {t('save')}
          </Button>
        </Card>
      )}

      {data && data.alerts.length === 0 && !formOpen ? (
        <Card className="text-sm text-hint">{t('alertsEmpty')}</Card>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="alert-list">
          {(data?.alerts ?? []).map((alert) => (
            <Card key={alert.id} className="flex items-center gap-3 p-3">
              <span>{STATUS_ICON[alert.status]}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {data ? describeAlert(alert, data) : ''}
                </p>
                <p className="text-xs text-hint">{t(TYPE_KEYS[alert.type])}</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className={cn(alert.status === 'PAUSED' && 'text-positive')}
                onClick={() => void setStatus(alert)}
              >
                {alert.status === 'PAUSED' ? t('resume') : t('pause')}
              </Button>
              <Button size="sm" variant="danger" onClick={() => void remove(alert)}>
                {t('remove')}
              </Button>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
