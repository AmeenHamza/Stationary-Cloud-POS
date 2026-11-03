import { describe, expect, it } from 'vitest';

import { loadConfig } from './app-config';

const valid = {
  DATABASE_URL: 'postgresql://pos:secret-db-pass@localhost:5432/pos',
  REDIS_URL: 'redis://:secret-redis-pass@localhost:6379/0',
  WEB_ORIGIN: 'http://localhost:3001',
  SETTINGS_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
};

describe('loadConfig', () => {
  it('applies documented defaults', () => {
    const config = loadConfig(valid);
    expect(config).toMatchObject({
      NODE_ENV: 'development',
      PORT: 4001,
      BUSINESS_TIMEZONE: 'Asia/Karachi',
      SESSION_IDLE_HOURS: 12,
      SESSION_ABSOLUTE_DAYS: 7,
      WORKER_ENABLED: true,
      DB_POOL_MAX: 10,
    });
  });

  it('rejects bad values and names the fields without echoing secrets', () => {
    const attempt = () =>
      loadConfig({
        ...valid,
        DATABASE_URL: 'mysql://user:secret-db-pass@host/db',
        SETTINGS_ENCRYPTION_KEY: 'c2hvcnQ=',
        BUSINESS_TIMEZONE: 'Mars/Base',
      });
    expect(attempt).toThrow(/DATABASE_URL/);
    expect(attempt).toThrow(/SETTINGS_ENCRYPTION_KEY/);
    expect(attempt).toThrow(/BUSINESS_TIMEZONE/);
    expect(attempt).not.toThrow(/secret-db-pass/);
  });

  it('requires a metrics token in production', () => {
    expect(() => loadConfig({ ...valid, NODE_ENV: 'production' })).toThrow(/METRICS_TOKEN/);
    const token = 'x'.repeat(32);
    expect(loadConfig({ ...valid, NODE_ENV: 'production', METRICS_TOKEN: token }).NODE_ENV).toBe(
      'production',
    );
  });

  it('parses boolean flags strictly', () => {
    expect(loadConfig({ ...valid, WORKER_ENABLED: 'false' }).WORKER_ENABLED).toBe(false);
    expect(() => loadConfig({ ...valid, WORKER_ENABLED: 'yes' })).toThrow(/WORKER_ENABLED/);
  });
});
