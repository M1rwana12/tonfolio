import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { TabBar } from '@/components/tab-bar';

import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'TONFOLIO',
  description: 'Non-custodial TON portfolio tracker',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  userScalable: false,
  themeColor: '#10141f',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uk">
      <body className="bg-background font-sans text-foreground antialiased">
        <Providers>
          <main className="mx-auto w-full max-w-md px-4 pt-4 pb-24">{children}</main>
          <TabBar />
        </Providers>
      </body>
    </html>
  );
}
