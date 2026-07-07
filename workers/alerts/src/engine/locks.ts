import type { Redis } from 'ioredis';

/** Idempotency: only one worker instance may fire a given alert per window. */
export interface AlertLock {
  acquire(key: string, ttlSec: number): Promise<boolean>;
}

export function redisAlertLock(redis: Redis): AlertLock {
  return {
    async acquire(key, ttlSec) {
      const result = await redis.set(`lock:${key}`, '1', 'EX', ttlSec, 'NX');
      return result === 'OK';
    },
  };
}

/** Single-process fallback for scripts and tests. */
export function memoryAlertLock(): AlertLock {
  const held = new Map<string, number>();
  return {
    acquire(key, ttlSec) {
      const now = Date.now();
      const expiry = held.get(key);
      if (expiry !== undefined && expiry > now) return Promise.resolve(false);
      held.set(key, now + ttlSec * 1000);
      return Promise.resolve(true);
    },
  };
}
