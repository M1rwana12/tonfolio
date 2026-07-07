'use client';

import { retrieveRawInitData } from '@telegram-apps/sdk-react';

export function authHeaders(): Record<string, string> {
  if (typeof window !== 'undefined') {
    try {
      const raw = retrieveRawInitData();
      if (raw) return { Authorization: `tma ${raw}` };
    } catch {
      // not running inside Telegram
    }
  }
  if (process.env.NEXT_PUBLIC_ALLOW_DEV_AUTH === '1') {
    return { 'x-dev-telegram-id': process.env.NEXT_PUBLIC_DEV_TELEGRAM_ID ?? '700000001' };
  }
  return {};
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...authHeaders(),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}
