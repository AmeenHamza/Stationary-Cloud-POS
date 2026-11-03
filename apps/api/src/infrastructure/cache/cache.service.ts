import { Inject, Injectable, Logger } from '@nestjs/common';

import { MetricsService } from '../metrics/metrics.service';
import { RedisStatus } from '../redis/redis-status';
import { REDIS_CLIENT } from '../redis/redis.clients';

import { CACHE_FAMILIES, CacheKeys, type CacheFamily } from './cache-keys';
import { SingleFlight } from './single-flight';

import type { Redis } from 'ioredis';

const ENVELOPE_SCHEMA = 1;

/** TTL with ±10 % jitter so keys written together do not expire together. */
function jitteredTtl(seconds: number): number {
  return Math.max(1, Math.round(seconds * (0.9 + Math.random() * 0.2)));
}

/**
 * Cache-aside over Redis (SYSTEM_DESIGN.md §6.3). Every Redis failure degrades to "not cached":
 * reads call the loader, writes are skipped. Never used for stock, prices, orders or ledgers.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly flights = new SingleFlight();
  /** Families whose generation bump failed: bypassed here until a bump succeeds (§6.5). */
  private readonly pendingBumps = new Set<CacheFamily>();

  constructor(
    @Inject(REDIS_CLIENT.cache) private readonly redis: Redis,
    private readonly metrics: MetricsService,
    status: RedisStatus,
  ) {
    // Invalidations may have been missed while Redis was unreachable: start every family fresh.
    status.onReady('cache', () => this.invalidate(CACHE_FAMILIES), { reconnectOnly: true });
  }

  async getOrLoad<T>(
    family: CacheFamily,
    variant: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    if (this.pendingBumps.has(family) && !(await this.bump(family))) {
      this.metrics.cacheRequests.inc({ family, result: 'bypass' });
      return loader();
    }
    const generation = await this.attempt(async () =>
      Number((await this.redis.get(CacheKeys.generation(family))) ?? 0),
    );
    if (generation === undefined) {
      this.metrics.cacheRequests.inc({ family, result: 'bypass' });
      return loader();
    }
    const key = CacheKeys.reference(family, generation, variant);
    const cached = await this.attempt(() => this.redis.get(key));
    const decoded = typeof cached === 'string' ? decode(cached) : undefined;
    if (decoded !== undefined) {
      this.metrics.cacheRequests.inc({ family, result: 'hit' });
      // Values under this key are only ever written from this family's loader, i.e. a T.
      return decoded.value as T;
    }
    this.metrics.cacheRequests.inc({ family, result: 'miss' });
    return this.flights.run(key, async () => {
      const value = await loader();
      // NX: a slow, stale fill can never overwrite a newer value; a bumped generation is never read.
      await this.attempt(() =>
        this.redis.set(key, encode(value), 'EX', jitteredTtl(ttlSeconds), 'NX'),
      );
      return value;
    });
  }

  /** Bumps each family's generation; old entries become unreachable and expire by TTL. */
  async invalidate(families: readonly CacheFamily[]): Promise<void> {
    for (const family of families) {
      await this.bump(family);
    }
  }

  /** INCR a generation. On failure this instance stops serving the family until a retry succeeds. */
  private async bump(family: CacheFamily): Promise<boolean> {
    const bumped =
      (await this.attempt(() => this.redis.incr(CacheKeys.generation(family)))) !== undefined;
    if (bumped) {
      this.pendingBumps.delete(family);
    } else {
      this.pendingBumps.add(family);
    }
    return bumped;
  }

  async getRaw(key: string): Promise<string | null> {
    return (await this.attempt(() => this.redis.get(key))) ?? null;
  }

  /** Returns true when the value was written (with `onlyIfAbsent`, false if the key existed). */
  async setRaw(
    key: string,
    value: string,
    ttlSeconds: number,
    onlyIfAbsent: boolean,
  ): Promise<boolean> {
    const result = await this.attempt(() =>
      onlyIfAbsent
        ? this.redis.set(key, value, 'EX', ttlSeconds, 'NX')
        : this.redis.set(key, value, 'EX', ttlSeconds),
    );
    return result === 'OK';
  }

  private async attempt<R>(operation: () => Promise<R>): Promise<R | undefined> {
    try {
      return await operation();
    } catch (error) {
      this.metrics.redisErrors.inc({ role: 'cache' });
      this.logger.debug(
        { reason: error instanceof Error ? error.message : String(error) },
        'Cache bypassed',
      );
      return undefined;
    }
  }
}

function encode(value: unknown): string {
  return JSON.stringify({ schema: ENVELOPE_SCHEMA, value });
}

function decode(raw: string): { value: unknown } | undefined {
  try {
    const parsed = JSON.parse(raw) as { schema?: unknown; value?: unknown };
    return parsed.schema === ENVELOPE_SCHEMA ? { value: parsed.value } : undefined;
  } catch {
    return undefined;
  }
}
