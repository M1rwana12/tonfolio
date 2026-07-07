import { describe, expect, it } from 'vitest';

import { SlidingWindowCounter } from './rate.js';

describe('SlidingWindowCounter', () => {
  it('allows hits under the limit and blocks at the limit', () => {
    const counter = new SlidingWindowCounter(2, 60_000);
    const t = 1_000_000;

    expect(counter.hit('u1', t).allowed).toBe(true);
    expect(counter.hit('u1', t + 1).allowed).toBe(true);
    expect(counter.hit('u1', t + 2).allowed).toBe(false);
    expect(counter.hit('u2', t + 2).allowed).toBe(true);
  });

  it('frees the budget once the window slides past old hits', () => {
    const counter = new SlidingWindowCounter(1, 60_000);
    const t = 1_000_000;

    expect(counter.hit('u1', t).allowed).toBe(true);
    expect(counter.hit('u1', t + 1_000).allowed).toBe(false);
    expect(counter.hit('u1', t + 61_000).allowed).toBe(true);
  });

  it('does not grow per-key state on blocked traffic', () => {
    const counter = new SlidingWindowCounter(2, 60_000);
    const t = 1_000_000;
    for (let i = 0; i < 1_000; i += 1) counter.hit('spammer', t + i);

    expect(counter.entryCount('spammer')).toBeLessThanOrEqual(2);
  });

  it('sweeps stale keys when the key cap is reached', () => {
    const counter = new SlidingWindowCounter(1, 1_000, 2);
    const t = 1_000_000;

    counter.hit('a', t);
    counter.hit('b', t);
    // both keys are stale by now; inserting a third triggers the sweep
    counter.hit('c', t + 10_000);

    expect(counter.size).toBe(1);
  });
});
