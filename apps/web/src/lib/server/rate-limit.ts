import { SlidingWindowCounter } from '@tonfolio/shared';

import { ApiError } from './http';

// Per-process sliding window; enough for a single-instance deployment.
// Redis takes over in production if the app ever scales horizontally.
const counters = new Map<number, SlidingWindowCounter>();

export function checkRateLimit(key: string, limit = 60): void {
  let counter = counters.get(limit);
  if (!counter) {
    counter = new SlidingWindowCounter(limit, 60_000);
    counters.set(limit, counter);
  }
  if (!counter.hit(key).allowed) {
    throw new ApiError(429, 'rate limit exceeded');
  }
}
