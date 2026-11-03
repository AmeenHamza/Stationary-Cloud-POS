import { Redis } from 'ioredis';
import { inject } from 'vitest';

import {
  assertLocalUrl,
  createTestDatabase,
  requireTestEnv,
  type TestDatabase,
} from '@pos/testkit';

import { sleep } from '../../src/common/time/sleep';

/** A fresh, migrated database for one test file, cloned from the run's template. */
export function createFileDatabase(): Promise<TestDatabase> {
  return createTestDatabase(requireTestEnv('TEST_DATABASE_URL'), {
    template: inject('templateDatabase'),
    prefix: 'api',
  });
}

/** The test Redis (logical DB 15, TESTING.md §2). Local only. */
export function testRedisUrl(): string {
  const url = requireTestEnv('TEST_REDIS_URL');
  assertLocalUrl(url);
  return url;
}

/** Empties the test Redis database so each file starts without cache or rate-limit keys. */
export async function flushTestRedis(): Promise<void> {
  const client = new Redis(testRedisUrl(), { lazyConnect: true });
  await client.connect();
  try {
    await client.flushdb();
  } finally {
    client.disconnect();
  }
}

/** Resolves with `promise`, or rejects once `ms` passes (event waits in tests never hang). */
export async function within<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  const deadline = sleep(ms).then(() => {
    throw new Error(`Timed out after ${String(ms)} ms waiting for ${what}`);
  });
  return Promise.race([promise, deadline]);
}
