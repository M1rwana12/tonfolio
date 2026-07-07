'use client';

import { Card } from '@/components/ui/card';
import { ChangeChip } from '@/components/ui/change-chip';
import { Skeleton } from '@/components/ui/skeleton';
import { pctChange, tokenAmount, usd } from '@/lib/format';
import { useT } from '@/lib/i18n';
import type { PortfolioResponse } from '@/lib/types';
import { useApi } from '@/lib/use-api';

export default function AssetsPage() {
  const t = useT();
  const { data, loading, error } = useApi<PortfolioResponse>('/api/portfolio');

  if (loading && !data) {
    return (
      <div className="flex flex-col gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  }
  if (error) return <Card className="text-sm text-negative">{t('error')}</Card>;

  const positions = data?.summary?.positions ?? [];

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-lg font-bold">{t('assetsTitle')}</h1>
      {positions.length === 0 ? (
        <Card className="text-sm text-hint">{t('emptyPortfolio')}</Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {positions.map((position) => (
            <Card key={position.assetId} className="flex items-center gap-3 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent">
                {position.symbol.slice(0, 3)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{position.symbol}</p>
                <p className="truncate font-mono text-xs text-hint">
                  {tokenAmount(position.amount, position.decimals)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium tabular-nums">{usd(position.valueUsd)}</p>
                <ChangeChip change={pctChange(position.change24Bps)} />
              </div>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
