import { Redis } from 'ioredis';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { AppError } from '../src/common/errors/app-error';
import { RateLimiterService } from '../src/infrastructure/rate-limit/rate-limiter.service';
import { RedisPubSub } from '../src/infrastructure/realtime/redis-pubsub';

import { startHarness, type Harness } from './support/harness';
import { testRedisUrl } from './support/services';

import type { RateLimitBucket } from '../src/infrastructure/rate-limit/buckets';

let h: Harness;
let limiter: RateLimiterService;

beforeAll(async () => {
  h = await startHarness();
  limiter = h.app.get(RateLimiterService);
});

afterAll(async () => {
  await h.stop();
});

afterEach(async () => {
  h.redisProxy.restore();
  await h.redisReady();
});

async function codeOf(work: Promise<void>): Promise<string | null> {
  try {
    await work;
    return null;
  } catch (error) {
    return error instanceof AppError ? error.code : 'UNEXPECTED';
  }
}

async function hitTimes(
  bucket: RateLimitBucket,
  key: string,
  times: number,
): Promise<(string | null)[]> {
  const codes: (string | null)[] = [];
  for (let i = 0; i < times; i += 1) {
    codes.push(await codeOf(limiter.consume(bucket, key)));
  }
  return codes;
}

describe('rate limits (API.md §8, RED-07)', () => {
  it('enforces a bucket through Redis', async () => {
    const codes = await hitTimes('login', 'user-a', 6);
    expect(codes.slice(0, 5).every((code) => code === null)).toBe(true);
    expect(codes[5]).toBe('RATE_LIMITED');
  });

  it('Redis down: login is limited in memory, sales are never limited, AI fails closed', async () => {
    await h.cutRedis();
    expect((await hitTimes('login', 'user-b', 6))[5]).toBe('RATE_LIMITED');
    expect((await hitTimes('sale', 'counter-1', 130)).every((code) => code === null)).toBe(true);
    expect(await codeOf(limiter.consume('ai', 'user-b'))).toBe('AI_UNAVAILABLE');
    expect(await codeOf(limiter.consume('export', 'user-b'))).toBe('RATE_LIMITED');
  });
});

describe('RedisPubSub (RT-05 infrastructure)', () => {
  it('1,000 subscribe/unsubscribe cycles leave no channels or listeners behind', async () => {
    const pubsub = h.app.get(RedisPubSub);
    const listeners = h.redis('subscriber').listenerCount('message');
    for (let i = 0; i < 1_000; i += 1) {
      const channel = `pos:v1:ev:user:leak-${String(i % 7)}`;
      const unsubscribe = await pubsub.subscribe([channel], () => undefined);
      await unsubscribe();
    }
    expect(pubsub.channelCount).toBe(0);
    expect(h.redis('subscriber').listenerCount('message')).toBe(listeners);
    const admin = new Redis(testRedisUrl());
    expect(await admin.pubsub('CHANNELS', 'pos:v1:ev:user:leak-*')).toEqual([]);
    admin.disconnect();
  });
});
