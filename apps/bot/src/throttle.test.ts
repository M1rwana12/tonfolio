import { describe, expect, it } from 'vitest';

import type { BotContext } from './context.js';
import { throttle } from './throttle.js';

function fakeCtx(userId: number, replies: string[]): BotContext {
  return {
    from: { id: userId, is_bot: false, first_name: 'T' },
    reply: (text: string) => {
      replies.push(text);
      return Promise.resolve({});
    },
  } as unknown as BotContext;
}

describe('throttle', () => {
  it('passes updates through under the limit', async () => {
    const middleware = throttle(3);
    const replies: string[] = [];
    let passed = 0;
    const next = () => {
      passed += 1;
      return Promise.resolve();
    };

    for (let i = 0; i < 3; i += 1) {
      await middleware(fakeCtx(1, replies), next);
    }
    expect(passed).toBe(3);
    expect(replies).toHaveLength(0);
  });

  it('drops excess updates and warns exactly once', async () => {
    const middleware = throttle(2);
    const replies: string[] = [];
    let passed = 0;
    const next = () => {
      passed += 1;
      return Promise.resolve();
    };

    for (let i = 0; i < 5; i += 1) {
      await middleware(fakeCtx(7, replies), next);
    }
    expect(passed).toBe(2);
    expect(replies).toHaveLength(1);
  });

  it('tracks users independently', async () => {
    const middleware = throttle(1);
    const replies: string[] = [];
    let passed = 0;
    const next = () => {
      passed += 1;
      return Promise.resolve();
    };

    await middleware(fakeCtx(1, replies), next);
    await middleware(fakeCtx(2, replies), next);
    expect(passed).toBe(2);
  });
});
