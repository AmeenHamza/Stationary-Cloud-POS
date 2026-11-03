import { AsyncLocalStorage } from 'node:async_hooks';

import { ClsService } from 'nestjs-cls';
import { describe, expect, it, vi } from 'vitest';

import { AfterCommit } from './after-commit';

function setup() {
  const cls = new ClsService(new AsyncLocalStorage());
  return { cls, afterCommit: new AfterCommit(cls) };
}

describe('AfterCommit', () => {
  it('batches items per collector and runs each handler once on flush', async () => {
    const { cls, afterCommit } = setup();
    const outbox = vi.fn(() => Promise.resolve());
    const cache = vi.fn(() => Promise.resolve());
    await cls.run(async () => {
      afterCommit.collect('outbox', 1n, outbox);
      afterCommit.collect('outbox', 2n, outbox);
      afterCommit.collect('cache', 'categories', cache);
      await afterCommit.flush();
      await afterCommit.flush(); // nothing left
    });
    expect(outbox).toHaveBeenCalledTimes(1);
    expect(outbox).toHaveBeenCalledWith([1n, 2n]);
    expect(cache).toHaveBeenCalledWith(['categories']);
  });

  it('reset discards work collected by a failed attempt', async () => {
    const { cls, afterCommit } = setup();
    const handler = vi.fn(() => Promise.resolve());
    await cls.run(async () => {
      afterCommit.collect('outbox', 1n, handler);
      afterCommit.reset();
      afterCommit.collect('outbox', 2n, handler);
      await afterCommit.flush();
    });
    expect(handler).toHaveBeenCalledWith([2n]);
  });

  it('a failing handler never stops the others (the commit already happened)', async () => {
    const { cls, afterCommit } = setup();
    const later = vi.fn(() => Promise.resolve());
    await cls.run(async () => {
      afterCommit.collect('outbox', 1, () => Promise.reject(new Error('redis down')));
      afterCommit.collect('cache', 2, later);
      await expect(afterCommit.flush()).resolves.toBeUndefined();
    });
    expect(later).toHaveBeenCalledWith([2]);
  });
});
