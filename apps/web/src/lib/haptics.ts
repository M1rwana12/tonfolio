'use client';

import { hapticFeedback } from '@telegram-apps/sdk-react';

export function tapHaptic(): void {
  try {
    if (hapticFeedback.impactOccurred.isAvailable()) {
      hapticFeedback.impactOccurred('light');
    }
  } catch {
    // outside Telegram
  }
}
