import { Redis } from 'ioredis';

/** Redis command and keyspace counters (M5), read with `INFO stats` before and after a run. */
export interface RedisStats {
  commands: number;
  hits: number;
  misses: number;
  networkInputBytes: number;
  networkOutputBytes: number;
}

const FIELDS: Readonly<Record<keyof RedisStats, string>> = {
  commands: 'total_commands_processed',
  hits: 'keyspace_hits',
  misses: 'keyspace_misses',
  networkInputBytes: 'total_net_input_bytes',
  networkOutputBytes: 'total_net_output_bytes',
};

export async function readRedisStats(redisUrl: string): Promise<RedisStats> {
  const client = new Redis(redisUrl, { lazyConnect: true });
  await client.connect();
  try {
    const info = await client.info('stats');
    const value = (field: string): number => {
      const match = new RegExp(`^${field}:(\\d+)`, 'm').exec(info);
      return match?.[1] === undefined ? 0 : Number.parseInt(match[1], 10);
    };
    return {
      commands: value(FIELDS.commands),
      hits: value(FIELDS.hits),
      misses: value(FIELDS.misses),
      networkInputBytes: value(FIELDS.networkInputBytes),
      networkOutputBytes: value(FIELDS.networkOutputBytes),
    };
  } finally {
    client.disconnect();
  }
}

export function redisDelta(before: RedisStats, after: RedisStats): RedisStats {
  return {
    commands: after.commands - before.commands,
    hits: after.hits - before.hits,
    misses: after.misses - before.misses,
    networkInputBytes: after.networkInputBytes - before.networkInputBytes,
    networkOutputBytes: after.networkOutputBytes - before.networkOutputBytes,
  };
}

/** Empties the local test Redis before a run (never a shared instance: local URLs only). */
export async function flushLocalRedis(redisUrl: string): Promise<void> {
  const client = new Redis(redisUrl, { lazyConnect: true });
  await client.connect();
  await client.flushdb();
  client.disconnect();
}
