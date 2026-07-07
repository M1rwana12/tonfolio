export interface HitResult {
  allowed: boolean;
  count: number;
}

/**
 * In-process sliding-window rate counter shared by the bot throttle and the
 * web API rate limiter. Blocked traffic does not grow per-key state, and the
 * key set is swept once it reaches maxKeys, so hostile bursts of unique keys
 * cannot leak memory in a long-lived process.
 */
export class SlidingWindowCounter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxKeys = 10_000,
  ) {}

  hit(key: string, now = Date.now()): HitResult {
    if (this.hits.size >= this.maxKeys && !this.hits.has(key)) {
      this.sweep(now);
    }
    const recent = (this.hits.get(key) ?? []).filter((t) => t > now - this.windowMs);
    const allowed = recent.length < this.limit;
    if (allowed) {
      recent.push(now);
    }
    this.hits.set(key, recent);
    return { allowed, count: recent.length };
  }

  get size(): number {
    return this.hits.size;
  }

  entryCount(key: string): number {
    return this.hits.get(key)?.length ?? 0;
  }

  private sweep(now: number): void {
    for (const [key, timestamps] of this.hits) {
      const alive = timestamps.filter((t) => t > now - this.windowMs);
      if (alive.length === 0) {
        this.hits.delete(key);
      } else {
        this.hits.set(key, alive);
      }
    }
  }
}
