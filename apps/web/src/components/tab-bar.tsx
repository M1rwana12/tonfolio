'use client';

import { Bell, Coins, History, WalletMinimal } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { tapHaptic } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
import type { MessageKey } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const tabs: Array<{ href: string; labelKey: MessageKey; icon: typeof Bell }> = [
  { href: '/', labelKey: 'navPortfolio', icon: WalletMinimal },
  { href: '/assets', labelKey: 'navAssets', icon: Coins },
  { href: '/transactions', labelKey: 'navHistory', icon: History },
  { href: '/alerts', labelKey: 'navAlerts', icon: Bell },
];

export function TabBar() {
  const pathname = usePathname();
  const t = useT();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-white/5 bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-md items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
        {tabs.map(({ href, labelKey, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={tapHaptic}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]',
                active ? 'text-accent' : 'text-hint',
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 2} />
              {t(labelKey)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
