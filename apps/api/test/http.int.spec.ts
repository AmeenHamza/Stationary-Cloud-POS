import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { TEST_METRICS_TOKEN, startTestApp } from './support/app-factory';
import { errorCode, postGraphql } from './support/graphql-client';
import { startHarness, type Harness } from './support/harness';
import { testRedisUrl } from './support/services';

let h: Harness;

beforeAll(async () => {
  h = await startHarness();
});

afterAll(async () => {
  await h.stop();
});

const getJson = async (path: string): Promise<{ status: number; body: unknown }> => {
  const response = await fetch(`${h.url}${path}`);
  return { status: response.status, body: await response.json() };
};

describe('health endpoints (API.md §9, RED-10)', () => {
  it('live answers without dependencies; ready reports both up', async () => {
    expect(await getJson('/health/live')).toEqual({ status: 200, body: { status: 'ok' } });
    expect(await getJson('/health/ready')).toEqual({
      status: 200,
      body: { status: 'ok', database: 'up', redis: 'up' },
    });
  });

  it('Redis down: ready stays 200 and reports degraded', async () => {
    await h.cutRedis();
    expect(await getJson('/health/ready')).toEqual({
      status: 200,
      body: { status: 'degraded', database: 'up', redis: 'degraded' },
    });
    expect((await getJson('/health/live')).status).toBe(200);
    h.redisProxy.restore();
    await h.redisReady();
    expect((await getJson('/health/ready')).body).toMatchObject({ status: 'ok', redis: 'up' });
  });

  it('PostgreSQL down: ready is 503 within the probe timeout; live is unaffected', async () => {
    h.databaseProxy.cut();
    const started = Date.now();
    const ready = await getJson('/health/ready');
    expect(ready).toEqual({
      status: 503,
      body: { status: 'unavailable', database: 'down', redis: 'up' },
    });
    expect(Date.now() - started).toBeLessThan(3_000);
    expect((await getJson('/health/live')).status).toBe(200);
    h.databaseProxy.restore();
    expect((await getJson('/health/ready')).status).toBe(200);
  });
});

describe('GraphQL over HTTP (API.md §1, §4)', () => {
  it('answers serverInfo with the version and business date', async () => {
    const response = await postGraphql<{ serverInfo: { version: string; businessDate: string } }>(
      h.url,
      '{ serverInfo { version businessDate } }',
    );
    expect(response.status).toBe(200);
    expect(response.body.data?.serverInfo.version).toBe('dev');
    expect(response.body.data?.serverInfo.businessDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('blocks CSRF-prone requests (GET without preflight header, text/plain)', async () => {
    const get = await fetch(`${h.url}/graphql?query=%7BserverInfo%7Bversion%7D%7D`);
    expect(get.status).toBe(400);
    const plain = await fetch(`${h.url}/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: JSON.stringify({ query: '{ serverInfo { version } }' }),
    });
    expect(plain.status).toBe(400);
  });

  it('rejects operations deeper than 10 levels as BAD_USER_INPUT', async () => {
    const chain = ['__schema', 'types', 'fields', 'type', ...Array<string>(6).fill('ofType')];
    const deep = `{ ${chain.map((field) => `${field} {`).join(' ')} name ${'} '.repeat(chain.length)}}`;
    const response = await postGraphql(h.url, deep); // 10 nested fields + name = depth 11
    expect(errorCode(response)).toBe('BAD_USER_INPUT');
    expect(response.body.errors?.[0]?.message).toMatch(/depth 11 exceeds the limit of 10/);
  });

  it('returns BAD_USER_INPUT for invalid operations, with no stack traces', async () => {
    const response = await postGraphql(h.url, '{ nope }');
    expect(errorCode(response)).toBe('BAD_USER_INPUT');
    expect(JSON.stringify(response.body)).not.toMatch(/stacktrace|at .*\.ts/);
  });
});

describe('metrics endpoint', () => {
  it('requires the bearer token', async () => {
    expect((await fetch(`${h.url}/metrics`)).status).toBe(401);
    const response = await fetch(`${h.url}/metrics`, {
      headers: { authorization: `Bearer ${TEST_METRICS_TOKEN}` },
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('pos_redis_up');
  });

  it('times GraphQL operations by name and outcome, never by argument (DEPLOYMENT.md §8)', async () => {
    await postGraphql(h.url, 'query MetricsProbe { serverInfo { version } }');
    await postGraphql(h.url, 'query MetricsProbe { nope }');
    const text = await (
      await fetch(`${h.url}/metrics`, {
        headers: { authorization: `Bearer ${TEST_METRICS_TOKEN}` },
      })
    ).text();
    expect(text).toContain(
      'pos_graphql_duration_seconds_count{operation="MetricsProbe",outcome="ok"} 1',
    );
    expect(text).toContain(
      'pos_graphql_duration_seconds_count{operation="MetricsProbe",outcome="error"} 1',
    );
    expect(text).toMatch(/^pos_ws_connections \d+$/m);
  });
});

describe('boot', () => {
  it('refuses to start with an invalid environment', async () => {
    await expect(
      startTestApp({ databaseUrl: 'mysql://nope', redisUrl: testRedisUrl() }),
    ).rejects.toThrow(/DATABASE_URL/);
  });

  it('turns introspection off in production', async () => {
    const production = await startTestApp({
      databaseUrl: h.db.url,
      redisUrl: testRedisUrl(),
      env: { NODE_ENV: 'production' },
    });
    try {
      const response = await postGraphql(production.url, '{ __schema { queryType { name } } }');
      expect(errorCode(response)).toBe('BAD_USER_INPUT');
      expect(response.body.data ?? null).toBeNull();
    } finally {
      await production.close();
    }
  });
});
