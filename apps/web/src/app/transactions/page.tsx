'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { shortAddress, shortHash, tokenAmount } from '@/lib/format';
import { useT } from '@/lib/i18n';
import type { ApiTransaction, PortfolioResponse, TransactionsResponse } from '@/lib/types';
import { useApi } from '@/lib/use-api';
import { cn } from '@/lib/utils';

export default function TransactionsPage() {
  const t = useT();
  const portfolio = useApi<PortfolioResponse>('/api/portfolio');
  const wallets = portfolio.data?.wallets ?? [];

  const [walletId, setWalletId] = useState<string | null>(null);
  const [items, setItems] = useState<ApiTransaction[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const activeWallet = walletId ?? wallets[0]?.id ?? null;

  useEffect(() => {
    if (!activeWallet) return;
    let cancelled = false;
    setLoading(true);
    setItems([]);
    api<TransactionsResponse>(`/api/transactions?walletId=${activeWallet}&limit=20`)
      .then((response) => {
        if (cancelled) return;
        setItems(response.items);
        setCursor(response.nextBeforeLt);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeWallet]);

  async function loadMore(): Promise<void> {
    if (!activeWallet || !cursor) return;
    setLoading(true);
    try {
      const response = await api<TransactionsResponse>(
        `/api/transactions?walletId=${activeWallet}&limit=20&beforeLt=${cursor}`,
      );
      setItems((prev) => [...prev, ...response.items]);
      setCursor(response.nextBeforeLt);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-lg font-bold">{t('txTitle')}</h1>

      {wallets.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {wallets.map((wallet) => (
            <button
              key={wallet.id}
              onClick={() => setWalletId(wallet.id)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 font-mono text-xs',
                wallet.id === activeWallet
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-card text-hint',
              )}
            >
              {wallet.label ?? shortAddress(wallet.addressFriendly)}
            </button>
          ))}
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="text-sm text-hint">{t('txEmpty')}</Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((tx) => (
            <Card key={tx.hash} className="flex items-center gap-3 p-3">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm',
                  tx.success ? 'bg-positive/15 text-positive' : 'bg-negative/15 text-negative',
                )}
              >
                {tx.success ? '↓' : '✕'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  {BigInt(tx.valueIn) > 0n ? `+${tokenAmount(tx.valueIn, 9)} TON` : '—'}
                </p>
                <p className="text-xs text-hint">{new Date(tx.utime * 1000).toLocaleString()}</p>
              </div>
              <a
                href={`https://tonviewer.com/transaction/${tx.hash}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs text-accent"
              >
                {shortHash(tx.hash)}
              </a>
            </Card>
          ))}
        </ul>
      )}

      {cursor && (
        <Button variant="secondary" onClick={() => void loadMore()} disabled={loading}>
          {t('loadMore')}
        </Button>
      )}
    </div>
  );
}
