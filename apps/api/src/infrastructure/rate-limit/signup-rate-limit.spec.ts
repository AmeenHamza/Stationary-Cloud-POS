import { describe, expect, it, vi } from 'vitest';

import { RateLimiterService } from './rate-limiter.service';

import type { ClockService } from '../../common/time/clock.service';
import type { MetricsService } from '../metrics/metrics.service';
import type { Redis } from 'ioredis';

function limiter(redis: Pick<Redis, 'eval'>) {
  const metrics = {
    rateLimitRejections: { inc: vi.fn() },
    rateLimitDegraded: { inc: vi.fn() },
  };
  return new RateLimiterService(
    redis as Redis,
    metrics as unknown as MetricsService,
    {} as ClockService,
  );
}

describe('signup rate limits', () => {
  it('blocks the sixth per-IP attempt and thirty-first global attempt', async () => {
    const counts = new Map<string, number>();
    const redis = {
      eval: vi.fn((_script: string, _keys: number, key: string) => {
        const count = (counts.get(key) ?? 0) + 1;
        counts.set(key, count);
        return Promise.resolve([count, 60_000]);
      }),
    } as unknown as Pick<Redis, 'eval'>;
    const service = limiter(redis);
    for (let n = 0; n < 5; n += 1) await service.consume('signup-ip', '127.0.0.1');
    await expect(service.consume('signup-ip', '127.0.0.1')).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
    for (let n = 0; n < 30; n += 1) await service.consume('signup-global', 'all');
    await expect(service.consume('signup-global', 'all')).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
  });

  it('fails closed on Redis errors for both buckets', async () => {
    const redis = { eval: vi.fn().mockRejectedValue(new Error('unavailable')) } as unknown as Pick<
      Redis,
      'eval'
    >;
    const service = limiter(redis);
    for (const bucket of ['signup-ip', 'signup-global'] as const) {
      await expect(service.consume(bucket, 'key')).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    }
  });
});
