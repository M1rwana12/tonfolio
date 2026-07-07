'use client';

import { useMemo } from 'react';
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { WalletConnect } from '@/components/wallet-connect';
import { Card, CardTitle } from '@/components/ui/card';
import { ChangeChip } from '@/components/ui/change-chip';
import { Skeleton } from '@/components/ui/skeleton';
import { pctChange, shortAddress, usd, usdToNumber } from '@/lib/format';
import { useT } from '@/lib/i18n';
import type { PortfolioResponse } from '@/lib/types';
import { useApi } from '@/lib/use-api';

const PALETTE = ['#2ea6ff', '#7c5cff', '#2ecf8a', '#ffb02e', '#f5564a', '#8b94a7'];

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-24" />
      <Skeleton className="h-44" />
      <Skeleton className="h-44" />
    </div>
  );
}

export default function DashboardPage() {
  const t = useT();
  const { data, loading, error, reload } = useApi<PortfolioResponse>('/api/portfolio');

  const donut = useMemo(() => {
    const positions = data?.summary?.positions ?? [];
    const top = positions.slice(0, 5).map((position, index) => ({
      name: position.symbol,
      value: usdToNumber(position.valueUsd),
      color: PALETTE[index % PALETTE.length] ?? '#8b94a7',
    }));
    const rest = positions.slice(5).reduce((sum, p) => sum + usdToNumber(p.valueUsd), 0);
    if (rest > 0) top.push({ name: t('other'), value: rest, color: '#8b94a7' });
    return top;
  }, [data, t]);

  const history = useMemo(
    () => (data?.history ?? []).map((point) => ({ t: point.t, usd: usdToNumber(point.usd) })),
    [data],
  );

  if (loading && !data) return <DashboardSkeleton />;
  if (error) {
    return (
      <Card>
        <p className="text-sm text-negative">{t('error')}</p>
        <button className="mt-2 text-sm text-accent" onClick={reload}>
          {t('retry')}
        </button>
      </Card>
    );
  }

  const summary = data?.summary ?? null;
  const change = pctChange(summary?.change24Bps ?? null);

  return (
    <div className="flex flex-col gap-4">
      <section>
        <p className="text-xs text-hint">{t('totalValue')}</p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums" data-testid="total-usd">
            {summary ? usd(summary.totalUsd) : '$0.00'}
          </span>
          {change && (
            <span className="flex items-center gap-1">
              <ChangeChip change={change} />
              <span className="text-xs text-hint">{t('change24h')}</span>
            </span>
          )}
        </div>
      </section>

      {summary && summary.positions.length > 0 ? (
        <>
          {history.length > 1 && (
            <Card>
              <CardTitle>{t('history30d')}</CardTitle>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="usdFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2ea6ff" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#2ea6ff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Tooltip
                      formatter={(value) => [`$${Number(value).toLocaleString()}`, 'USD']}
                      labelFormatter={(label) => new Date(Number(label)).toLocaleDateString()}
                      contentStyle={{
                        background: 'var(--bg-secondary)',
                        border: 'none',
                        borderRadius: 12,
                        color: 'var(--text)',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="usd"
                      stroke="#2ea6ff"
                      strokeWidth={2}
                      fill="url(#usdFill)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          <Card>
            <CardTitle>{t('allocation')}</CardTitle>
            <div className="flex items-center gap-4">
              <div className="h-32 w-32 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donut}
                      dataKey="value"
                      innerRadius={38}
                      outerRadius={56}
                      paddingAngle={2}
                      strokeWidth={0}
                      isAnimationActive={false}
                    >
                      {donut.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="flex-1 space-y-1.5 text-sm">
                {donut.map((entry) => (
                  <li key={entry.name} className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: entry.color }}
                    />
                    <span className="flex-1">{entry.name}</span>
                    <span className="text-hint tabular-nums">
                      ${entry.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </>
      ) : (
        <Card>
          <p className="text-sm text-hint">{t('emptyPortfolio')}</p>
        </Card>
      )}

      <Card>
        <CardTitle>{t('wallets')}</CardTitle>
        <ul className="mb-3 space-y-2">
          {(data?.wallets ?? []).map((wallet) => (
            <li key={wallet.id} className="flex items-center justify-between text-sm">
              <span className="font-mono">{shortAddress(wallet.addressFriendly)}</span>
              <span className="text-xs text-hint">
                {wallet.verified ? `✅ ${t('verified')}` : `👁 ${t('watchOnly')}`}
              </span>
            </li>
          ))}
        </ul>
        <WalletConnect onVerified={reload} />
      </Card>
    </div>
  );
}
