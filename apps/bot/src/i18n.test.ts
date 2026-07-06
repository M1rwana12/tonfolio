import { describe, expect, it } from 'vitest';

import { t } from './i18n.js';

describe('t', () => {
  it('returns the message for the requested locale', () => {
    expect(t('uk', 'cancelled')).toBe('Скасовано.');
    expect(t('en', 'cancelled')).toBe('Cancelled.');
  });

  it('interpolates named parameters', () => {
    expect(t('en', 'addWalletLimit', { limit: 5 })).toContain('5');
  });
});
