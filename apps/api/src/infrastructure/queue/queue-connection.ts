import type { ConnectionOptions } from 'bullmq';

/**
 * BullMQ connection options from `REDIS_URL` (BullMQ opens its own connections: a worker needs a
 * blocking one, and `maxRetriesPerRequest: null`). `rediss:` turns TLS on.
 */
export function queueConnection(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);
  const db = url.pathname.replace('/', '');
  return {
    host: url.hostname,
    port: url.port === '' ? 6379 : Number.parseInt(url.port, 10),
    ...(url.username === '' ? {} : { username: decodeURIComponent(url.username) }),
    ...(url.password === '' ? {} : { password: decodeURIComponent(url.password) }),
    ...(db === '' ? {} : { db: Number.parseInt(db, 10) }),
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
    connectionName: 'pos-api-queue',
  };
}
