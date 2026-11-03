import { createHash } from 'node:crypto';

import { Redis } from 'ioredis';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { querySql } from '@pos/testkit';

import { channelFor, userAudience } from '../src/infrastructure/realtime/channels';

import { createUser, loginCookie, whoAmI } from './support/auth';
import { listenTo } from './support/channel-listener';
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

afterEach(async () => {
  h.redisProxy.restore();
  await h.redisReady();
});

const CHANGE = `mutation Change($input: ChangePasswordInput!) { changePassword(input: $input) }`;

const sessionKey = (cookie: string): string =>
  `pos:v1:sess:${createHash('sha256')
    .update(cookie.split('=')[1] ?? '')
    .digest('hex')}`;

describe('changePassword (F-03, SYSTEM_DESIGN.md §2.3)', () => {
  it('rejects a wrong current password with a field error', async () => {
    const user = await createUser(h, { username: 'clerk1' });
    const cookie = await loginCookie(h.url, user);
    const response = await postGraphql(h.url, CHANGE, {
      variables: { input: { currentPassword: 'wrong-one', newPassword: 'brand-new-pass-1' } },
      headers: { cookie },
    });
    expect(errorCode(response)).toBe('BAD_USER_INPUT');
    expect(response.body.errors?.[0]?.extensions?.['fieldErrors']).toHaveProperty(
      'currentPassword',
    );
  });

  it('keeps this session, revokes the others and tells their sockets (session.revoked)', async () => {
    const user = await createUser(h, { username: 'clerk2' });
    const counterA = await loginCookie(h.url, user);
    const counterB = await loginCookie(h.url, user);
    expect(await whoAmI(h.url, counterB)).toBe('clerk2'); // B's principal is now cached
    const events = await listenTo([channelFor(userAudience(user.id))]);
    try {
      const response = await postGraphql(h.url, CHANGE, {
        variables: { input: { currentPassword: user.password, newPassword: 'brand-new-pass-2' } },
        headers: { cookie: counterA },
      });
      expect(response.body.data).toEqual({ changePassword: true });
      expect(await whoAmI(h.url, counterA)).toBe('clerk2');
      expect(await whoAmI(h.url, counterB)).toBe('UNAUTHENTICATED'); // tombstone beats the cache
      expect(JSON.parse(await events.next())).toMatchObject({ type: 'session.revoked' });
    } finally {
      await events.close();
    }
    await expect(loginCookie(h.url, user)).rejects.toThrow();
    await expect(loginCookie(h.url, { ...user, password: 'brand-new-pass-2' })).resolves.toMatch(
      /^__Host/,
    );
  });
});

describe('session cache (RED-05, Redis down)', () => {
  it('RED-05: a stale fill never overwrites a revocation tombstone', async () => {
    const user = await createUser(h, { username: 'clerk3' });
    const cookie = await loginCookie(h.url, user);
    await postGraphql(h.url, 'mutation { logout }', { headers: { cookie } });
    const redis = new Redis(testRedisUrl());
    try {
      expect(await redis.get(sessionKey(cookie))).toBe('REVOKED');
      // A request that read the session before the revocation now tries to fill the cache (NX).
      const filled = await redis.set(sessionKey(cookie), '{"stale":true}', 'EX', 300, 'NX');
      expect(filled).toBeNull();
    } finally {
      redis.disconnect();
    }
    expect(await whoAmI(h.url, cookie)).toBe('UNAUTHENTICATED');
  });

  it('works without Redis: login, me and revocation all fall back to PostgreSQL', async () => {
    const user = await createUser(h, { username: 'clerk4' });
    await h.cutRedis();
    const cookie = await loginCookie(h.url, user);
    expect(await whoAmI(h.url, cookie)).toBe('clerk4');
    await postGraphql(h.url, 'mutation { logout }', { headers: { cookie } });
    expect(await whoAmI(h.url, cookie)).toBe('UNAUTHENTICATED');
    const [row] = await querySql<{ n: string }>(
      h.db.url,
      "SELECT count(*)::text AS n FROM outbox_events WHERE type = 'session.revoked' AND published_at IS NULL",
    );
    expect(Number(row?.n)).toBeGreaterThanOrEqual(1); // published once Redis is back
  });
});
