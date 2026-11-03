import { Inject, Injectable } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import { ClockService } from '../../common/time/clock.service';
import { CacheKeys } from '../cache/cache-keys';
import { MetricsService } from '../metrics/metrics.service';
import { REDIS_CLIENT } from '../redis/redis.clients';

import { RATE_LIMIT_BUCKETS, type BucketDefinition, type RateLimitBucket } from './buckets';
import { MemoryWindow } from './memory-window';

import type { Redis } from 'ioredis';

/** Atomic fixed window: INCR, set the expiry on the first hit, return count and remaining ms. */
const FIXED_WINDOW = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return { count, redis.call('PTTL', KEYS[1]) }`;

interface WindowState {
  count: number;
  resetInMs: number;
}

/**
 * Shared rate limiting across API instances (ADR-024, API.md §8). Throws RATE_LIMITED with
 * `retryAfterSeconds` when a bucket is exhausted; applies the bucket's policy when Redis is down.
 */
@Injectable()
export class RateLimiterService {
  private readonly memory = new MemoryWindow();

  constructor(
    @Inject(REDIS_CLIENT.cache) private readonly redis: Redis,
    private readonly metrics: MetricsService,
    private readonly clock: ClockService,
  ) {}

  async consume(bucketName: RateLimitBucket, key: string): Promise<void> {
    const bucket: BucketDefinition = RATE_LIMIT_BUCKETS[bucketName];
    const redisKey = CacheKeys.rateLimit(bucketName, key);
    let state: WindowState | null;
    try {
      const [count, pttl] = (await this.redis.eval(FIXED_WINDOW, 1, redisKey, bucket.windowMs)) as [
        number,
        number,
      ];
      state = { count, resetInMs: pttl };
    } catch {
      state = this.whenRedisDown(bucketName, bucket, redisKey);
    }
    if (state !== null && state.count > bucket.limit) {
      this.metrics.rateLimitRejections.inc({ bucket: bucketName });
      throw new AppError('RATE_LIMITED', 'Too many attempts. Please wait and try again.', {
        retryAfterSeconds: Math.max(1, Math.ceil(state.resetInMs / 1000)),
      });
    }
  }

  private whenRedisDown(
    name: RateLimitBucket,
    bucket: BucketDefinition,
    key: string,
  ): WindowState | null {
    const policy = bucket.onRedisDown;
    this.metrics.rateLimitDegraded.inc({ bucket: name, policy: policy.kind });
    switch (policy.kind) {
      case 'memory':
        return this.memory.hit(key, bucket.windowMs, this.clock.now().getTime());
      case 'open':
        return null;
      case 'closed':
        throw new AppError(
          policy.code,
          'This feature is temporarily unavailable. Try again shortly.',
          {
            retryAfterSeconds: 30,
          },
        );
    }
  }
}
