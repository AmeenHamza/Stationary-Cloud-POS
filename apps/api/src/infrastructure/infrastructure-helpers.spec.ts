import { describe, expect, it, vi } from 'vitest';

import { CacheKeys, REDIS_NAMESPACE } from './cache/cache-keys';
import { SingleFlight } from './cache/single-flight';
import { withTransactionRetry } from './prisma/transaction-retry';
import { MemoryWindow } from './rate-limit/memory-window';
import { reconnectDelay, redisOptions } from './redis/redis.clients';

const NO_DELAY = { attempts: 3, minDelayMs: 0, maxDelayMs: 0 };
const serializationFailure = Object.assign(new Error('could not serialize'), { code: 'P2034' });

describe('withTransactionRetry', () => {
  it('retries serialization failures and returns the eventual result', async () => {
    const work = vi.fn().mockRejectedValueOnce(serializationFailure).mockResolvedValueOnce('done');
    await expect(withTransactionRetry(work, NO_DELAY)).resolves.toBe('done');
    expect(work).toHaveBeenCalledTimes(2);
  });

  it('gives up after the configured attempts', async () => {
    const work = vi.fn().mockRejectedValue(serializationFailure);
    await expect(withTransactionRetry(work, NO_DELAY)).rejects.toBe(serializationFailure);
    expect(work).toHaveBeenCalledTimes(3);
  });

  it('does not retry other errors', async () => {
    const work = vi.fn().mockRejectedValue(new Error('CHECK constraint failed'));
    await expect(withTransactionRetry(work, NO_DELAY)).rejects.toThrow('CHECK');
    expect(work).toHaveBeenCalledTimes(1);
  });
});

describe('SingleFlight', () => {
  it('shares one in-flight load per key and forgets it when settled', async () => {
    const flight = new SingleFlight();
    let release: (value: string) => void = () => undefined;
    const loader = vi.fn(() => new Promise<string>((resolve) => (release = resolve)));
    const first = flight.run('k', loader);
    const second = flight.run('k', loader);
    expect(flight.size).toBe(1);
    release('v');
    await expect(Promise.all([first, second])).resolves.toEqual(['v', 'v']);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(flight.size).toBe(0);
  });

  it('forgets failed loads so the next call retries', async () => {
    const flight = new SingleFlight();
    await expect(flight.run('k', () => Promise.reject(new Error('db down')))).rejects.toThrow();
    await expect(flight.run('k', () => Promise.resolve(1))).resolves.toBe(1);
  });
});

describe('MemoryWindow', () => {
  it('counts hits in a fixed window and resets after it', () => {
    const window = new MemoryWindow();
    expect(window.hit('ip', 1_000, 0)).toEqual({ count: 1, resetInMs: 1_000 });
    expect(window.hit('ip', 1_000, 400)).toEqual({ count: 2, resetInMs: 600 });
    expect(window.hit('ip', 1_000, 1_000)).toEqual({ count: 1, resetInMs: 1_000 });
  });

  it('stays bounded: expired entries go first, then the oldest', () => {
    const window = new MemoryWindow(2);
    window.hit('a', 100, 0);
    window.hit('b', 1_000, 0);
    window.hit('c', 1_000, 200); // 'a' expired → dropped
    expect(window.size).toBe(2);
    window.hit('d', 1_000, 300); // none expired → oldest ('b') dropped
    expect(window.size).toBe(2);
    expect(window.hit('c', 1_000, 300).count).toBe(2);
    expect(window.hit('b', 1_000, 300).count).toBe(1);
  });
});

describe('Redis client settings', () => {
  it('backs off exponentially with jitter, capped at 5 s', () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const ceiling = Math.min(5_000, 200 * 2 ** Math.min(attempt, 5));
      const delay = reconnectDelay(attempt);
      expect(delay).toBeGreaterThanOrEqual(ceiling / 2);
      expect(delay).toBeLessThanOrEqual(ceiling);
    }
  });

  it('fails fast for cache and publisher, queues for the subscriber', () => {
    expect(redisOptions('cache')).toMatchObject({ enableOfflineQueue: false, commandTimeout: 1_000 });
    expect(redisOptions('publisher')).toMatchObject({
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });
    expect(redisOptions('subscriber')).toMatchObject({
      enableOfflineQueue: true,
      autoResubscribe: true,
    });
  });

  it('builds every key under the versioned namespace', () => {
    const keys = [
      CacheKeys.session('ab12'),
      CacheKeys.generation('categories'),
      CacheKeys.reference('settings', 3, 'shop'),
      CacheKeys.ai('insights', 'h'),
      CacheKeys.rateLimit('login', 'u'),
    ];
    expect(keys.every((key) => key.startsWith(`${REDIS_NAMESPACE}:`))).toBe(true);
    expect(CacheKeys.reference('settings', 3, 'shop')).toBe('pos:v1:ref:settings:g3:shop');
  });
});
