import { Redis } from 'ioredis';

/** Client roles (SYSTEM_DESIGN.md §6.1). BullMQ creates its own connections when introduced. */
export type RedisRole = 'cache' | 'publisher' | 'subscriber';

export const REDIS_CLIENT = {
  cache: 'REDIS_CACHE',
  publisher: 'REDIS_PUBLISHER',
  subscriber: 'REDIS_SUBSCRIBER',
} as const satisfies Record<RedisRole, string>;

/** A cache command slower than this is treated as a miss (SYSTEM_DESIGN.md §6.5). */
export const CACHE_COMMAND_TIMEOUT_MS = 1_000;

/** Reconnect delay: exponential, capped at 5 s, with jitter (only after a disconnect). */
export function reconnectDelay(attempt: number): number {
  const ceiling = Math.min(5_000, 200 * 2 ** Math.min(attempt, 5));
  return Math.round(ceiling / 2 + Math.random() * (ceiling / 2));
}

/**
 * Cache and publisher fail fast (no offline queue, one retry, short timeouts) so a Redis problem
 * becomes a cache miss or an unpublished outbox row, never a stuck request. The subscriber keeps
 * its subscriptions across reconnects.
 */
export function redisOptions(role: RedisRole) {
  const common = {
    connectionName: `pos-api-${role}`,
    connectTimeout: 2_000,
    retryStrategy: reconnectDelay,
  };
  switch (role) {
    case 'cache':
      return {
        ...common,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        commandTimeout: CACHE_COMMAND_TIMEOUT_MS,
      };
    case 'publisher':
      return {
        ...common,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        commandTimeout: 1_000,
      };
    case 'subscriber':
      return {
        ...common,
        maxRetriesPerRequest: null,
        enableOfflineQueue: true,
        autoResubscribe: true,
      };
  }
}

export function createRedisClient(url: string, role: RedisRole): Redis {
  return new Redis(url, redisOptions(role));
}
