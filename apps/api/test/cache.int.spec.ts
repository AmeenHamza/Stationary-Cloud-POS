import { Redis } from 'ioredis';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { CacheService } from '../src/infrastructure/cache/cache.service';
import { CACHE_COMMAND_TIMEOUT_MS } from '../src/infrastructure/redis/redis.clients';

import { startHarness, type Harness } from './support/harness';
import { testRedisUrl } from './support/services';

/** Cache-semantics tests tolerate cold-start latency; RED-06 uses the production timeout. */
const RELAXED_TIMEOUT_MS = 2_000;

let h: Harness;
let cache: CacheService;

const setCommandTimeout = (ms: number): void => {
  h.redis('cache').options.commandTimeout = ms;
};

beforeAll(async () => {
  h = await startHarness();
  cache = h.app.get(CacheService);
  setCommandTimeout(RELAXED_TIMEOUT_MS);
});

afterAll(async () => {
  await h.stop();
});

afterEach(async () => {
  setCommandTimeout(RELAXED_TIMEOUT_MS);
  h.redisProxy.restore();
  await h.redisReady();
});

const load = (value: string) => vi.fn(() => Promise.resolve(value));

describe('reference cache (SYSTEM_DESIGN.md §6.3, §6.5)', () => {
  it('RED-03: serves from cache until invalidated, then loads the new value', async () => {
    expect(await cache.getOrLoad('settings', 'red03', 60, load('v1'))).toBe('v1');
    const cachedLoader = load('unused');
    expect(await cache.getOrLoad('settings', 'red03', 60, cachedLoader)).toBe('v1');
    expect(cachedLoader).not.toHaveBeenCalled();
    await cache.invalidate(['settings']);
    expect(await cache.getOrLoad('settings', 'red03', 60, load('v2'))).toBe('v2');
  });

  it('RED-04: a slow fill that overlaps an invalidation is never served', async () => {
    let finishSlowLoad: (value: string) => void = () => undefined;
    let loaderStarted: () => void = () => undefined;
    const started = new Promise<void>((resolve) => (loaderStarted = resolve));
    const slow = cache.getOrLoad('categories', 'red04', 60, () => {
      loaderStarted();
      return new Promise<string>((resolve) => (finishSlowLoad = resolve));
    });
    await started; // the reader has read generation g and is loading from the database
    await cache.invalidate(['categories']); // a write commits meanwhile: g → g+1
    finishSlowLoad('stale');
    expect(await slow).toBe('stale'); // the caller that started early gets what it loaded
    expect(await cache.getOrLoad('categories', 'red04', 60, load('fresh'))).toBe('fresh');
  });

  it('RED-06: with the production timeout, a stalled Redis becomes a cache miss', async () => {
    setCommandTimeout(CACHE_COMMAND_TIMEOUT_MS);
    h.redisProxy.stall();
    const started = Date.now();
    expect(await cache.getOrLoad('settings', 'red06', 60, load('from-db'))).toBe('from-db');
    const elapsed = Date.now() - started;
    expect(elapsed).toBeGreaterThanOrEqual(CACHE_COMMAND_TIMEOUT_MS - 250);
    expect(elapsed).toBeLessThan(CACHE_COMMAND_TIMEOUT_MS + 1_000);
  });

  it('Redis down: the loader is called directly', async () => {
    await h.cutRedis();
    const loader = load('direct');
    expect(await cache.getOrLoad('settings', 'down', 60, loader)).toBe('direct');
    expect(loader).toHaveBeenCalledOnce();
  });

  it('RED-09: out of memory never fails a read, and a failed invalidation is not served stale', async () => {
    const admin = new Redis(testRedisUrl());
    const [, original] = (await admin.config('GET', 'maxmemory')) as [string, string];
    try {
      expect(await cache.getOrLoad('settings', 'red09', 60, load('before'))).toBe('before');
      await admin.config('SET', 'maxmemory', '1');
      expect(await cache.getOrLoad('categories', 'red09', 60, load('oom-fill'))).toBe('oom-fill');
      await cache.invalidate(['settings']); // INCR is refused under OOM
      expect(await cache.getOrLoad('settings', 'red09', 60, load('after'))).toBe('after');
      await admin.config('SET', 'maxmemory', original);
      expect(await cache.getOrLoad('settings', 'red09', 60, load('recovered'))).toBe('recovered');
      expect(await cache.getOrLoad('settings', 'red09', 60, load('unused'))).toBe('recovered');
    } finally {
      await admin.config('SET', 'maxmemory', original);
      admin.disconnect();
    }
  });
});
