import { ApiError } from './http';

const WINDOW_MS = 60_000;

// Per-process sliding window; enough for a single-instance deployment.
// Redis takes over in production if the app ever scales horizontally.
const hits = new Map<string, number[]>();

export function checkRateLimit(key: string, limit = 60): void {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  const timestamps = (hits.get(key) ?? []).filter((t) => t > windowStart);
  if (timestamps.length >= limit) {
    throw new ApiError(429, 'rate limit exceeded');
  }
  timestamps.push(now);
  hits.set(key, timestamps);
}
