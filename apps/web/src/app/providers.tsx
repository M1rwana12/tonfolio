'use client';

import { init, retrieveLaunchParams, themeParams, viewport } from '@telegram-apps/sdk-react';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { LocaleContext } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';

export function Providers({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>('uk');

  useEffect(() => {
    // every step degrades gracefully outside Telegram (plain browser / e2e)
    try {
      init();
    } catch {
      return;
    }
    try {
      if (themeParams.mountSync.isAvailable()) themeParams.mountSync();
      if (themeParams.bindCssVars.isAvailable()) themeParams.bindCssVars();
    } catch {
      /* theme stays on dark defaults */
    }
    try {
      if (viewport.mount.isAvailable()) {
        void viewport.mount().then(() => {
          if (viewport.expand.isAvailable()) viewport.expand();
        });
      }
    } catch {
      /* viewport API unavailable */
    }
    try {
      const launchParams = retrieveLaunchParams();
      const language = launchParams.tgWebAppData?.user?.language_code;
      setLocale(language === 'en' ? 'en' : 'uk');
    } catch {
      /* keep default locale */
    }
  }, []);

  const manifestUrl = useMemo(
    () =>
      typeof window === 'undefined'
        ? 'https://tonfolio.example.com/tonconnect-manifest.json'
        : `${window.location.origin}/tonconnect-manifest.json`,
    [],
  );

  return (
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
    </TonConnectUIProvider>
  );
}
