import {
  createStatementCounter,
  createTcpProxy,
  type StatementCounter,
  type TcpProxy,
  type TestDatabase,
} from '@pos/testkit';

import { REDIS_CLIENT, type RedisRole } from '../../src/infrastructure/redis/redis.clients';

import { startTestApp, type TestApp } from './app-factory';
import { createFileDatabase, flushTestRedis, testRedisUrl, within } from './services';

import type { Redis } from 'ioredis';

/**
 * One API instance on a cloned database. PostgreSQL and Redis are reached through TCP proxies so
 * tests can cut, stall and restore either link (TESTING.md §2).
 */
export interface Harness extends TestApp {
  db: TestDatabase;
  redisProxy: TcpProxy;
  databaseProxy: TcpProxy;
  /** SQL statements the API sent since the last `reset()` (NET-02, PAG-07). */
  statements: StatementCounter;
  /** Bytes between the API and PostgreSQL, both directions, since the last `reset()` (NET-03). */
  dbBytes: { readonly total: number; reset: () => void };
  redis: (role: RedisRole) => Redis;
  /** Resolves once the given Redis clients (default: all) are ready. */
  redisReady: (roles?: readonly RedisRole[]) => Promise<void>;
  /** Cuts the Redis link and resolves once every client has noticed (simulated outage). */
  cutRedis: () => Promise<void>;
  stop: () => Promise<void>;
}

const ROLES: readonly RedisRole[] = ['cache', 'publisher', 'subscriber'];

/**
 * Waits for the status event only. `events.once` would reject on the first `error` event, and a
 * transient one (e.g. the ready check exceeding the cache client's timeout on a loaded
 * machine) is expected: the client reconnects by itself, as the API does in production.
 */
export async function waitForStatus(client: Redis, status: 'ready' | 'close'): Promise<void> {
  const reached = status === 'ready' ? client.status === 'ready' : client.status !== 'ready';
  if (!reached) {
    const event = new Promise<void>((resolve) => {
      client.once(status, () => {
        resolve();
      });
    });
    await within(event, 15_000, `Redis ${status}`);
  }
}

export async function startHarness(
  options: { env?: Readonly<Record<string, string>>; db?: TestDatabase } = {},
): Promise<Harness> {
  await flushTestRedis();
  const db = options.db ?? (await createFileDatabase());
  const redisProxy = await createTcpProxy(testRedisUrl());
  const statements = createStatementCounter();
  let transferred = 0;
  const dbBytes = {
    get total() {
      return transferred;
    },
    reset: () => {
      transferred = 0;
    },
  };
  const databaseProxy = await createTcpProxy(db.url, {
    onClientData: (connection, chunk) => {
      statements.feed(connection, chunk);
      transferred += chunk.length;
    },
    onServerData: (_connection, chunk) => {
      transferred += chunk.length;
    },
  });
  const app = await startTestApp({
    databaseUrl: databaseProxy.wrap(db.url),
    redisUrl: redisProxy.wrap(testRedisUrl()),
    ...(options.env === undefined ? {} : { env: options.env }),
  });
  const redis = (role: RedisRole): Redis => app.app.get<Redis>(REDIS_CLIENT[role]);
  const redisReady = async (roles: readonly RedisRole[] = ROLES): Promise<void> => {
    await Promise.all(roles.map((role) => waitForStatus(redis(role), 'ready')));
  };
  const cutRedis = async (): Promise<void> => {
    const closed = Promise.all(ROLES.map((role) => waitForStatus(redis(role), 'close')));
    redisProxy.cut();
    await closed;
  };
  await redisReady();
  return {
    ...app,
    db,
    redisProxy,
    databaseProxy,
    statements,
    dbBytes,
    redis,
    redisReady,
    cutRedis,
    stop: async () => {
      await app.close();
      await Promise.all([redisProxy.close(), databaseProxy.close()]);
      if (options.db === undefined) {
        await db.drop();
      }
    },
  };
}
