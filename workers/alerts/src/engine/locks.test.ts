import { describe, expect, it } from 'vitest';

import { memoryAlertLock } from './locks.js';

describe('memoryAlertLock', () => {
  it('grants the lock only once per TTL window (idempotent firing)', async () => {
    const lock = memoryAlertLock();

    await expect(lock.acquire('alert:1', 60)).resolves.toBe(true);
    await expect(lock.acquire('alert:1', 60)).resolves.toBe(false);
    await expect(lock.acquire('alert:2', 60)).resolves.toBe(true);
  });

  it('releases the lock after the TTL expires', async () => {
    const lock = memoryAlertLock();

    await expect(lock.acquire('alert:1', 0)).resolves.toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await expect(lock.acquire('alert:1', 60)).resolves.toBe(true);
  });
});
