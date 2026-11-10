import type { ErrorCode } from '@pos/contracts';

/** What a bucket does when Redis is unavailable (API.md §8). */
export type RedisDownPolicy =
  { kind: 'memory' } | { kind: 'open' } | { kind: 'closed'; code: ErrorCode };

export interface BucketDefinition {
  limit: number;
  windowMs: number;
  onRedisDown: RedisDownPolicy;
}

const MINUTE = 60_000;

/** Named buckets. Sales and general traffic fail open so billing is never blocked by Redis. */
export const RATE_LIMIT_BUCKETS = {
  login: { limit: 5, windowMs: 15 * MINUTE, onRedisDown: { kind: 'memory' } },
  'login-ip': { limit: 30, windowMs: 15 * MINUTE, onRedisDown: { kind: 'memory' } },
  'signup-ip': {
    limit: 5,
    windowMs: 15 * MINUTE,
    onRedisDown: { kind: 'closed', code: 'RATE_LIMITED' },
  },
  'signup-global': {
    limit: 30,
    windowMs: 15 * MINUTE,
    onRedisDown: { kind: 'closed', code: 'RATE_LIMITED' },
  },
  password: { limit: 5, windowMs: 60 * MINUTE, onRedisDown: { kind: 'memory' } },
  'ws-connect': { limit: 30, windowMs: MINUTE, onRedisDown: { kind: 'memory' } },
  default: { limit: 600, windowMs: MINUTE, onRedisDown: { kind: 'open' } },
  sale: { limit: 120, windowMs: MINUTE, onRedisDown: { kind: 'open' } },
  // AI and export count in per-instance memory while Redis is down (ADR-049) instead of refusing
  // every request: the same hourly limits still hold, so Groq calls and export reads stay bounded.
  ai: { limit: 30, windowMs: 60 * MINUTE, onRedisDown: { kind: 'memory' } },
  export: { limit: 20, windowMs: 60 * MINUTE, onRedisDown: { kind: 'memory' } },
  // Uploads are staged in PostgreSQL and queued when Redis is back (ADR-020, RED-08), so the
  // limit falls back to per-instance memory instead of refusing every upload.
  import: { limit: 10, windowMs: 60 * MINUTE, onRedisDown: { kind: 'memory' } },
} as const satisfies Record<string, BucketDefinition>;

export type RateLimitBucket = keyof typeof RATE_LIMIT_BUCKETS;
