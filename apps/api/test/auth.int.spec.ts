import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { querySql } from '@pos/testkit';

import { createUser, LOGIN, loginCookie, whoAmI, type TestUser } from './support/auth';
import { errorCode, postGraphql } from './support/graphql-client';
import { startHarness, type Harness } from './support/harness';

let h: Harness;
let admin: TestUser;

beforeAll(async () => {
  h = await startHarness();
  admin = await createUser(h, { username: 'owner', role: 'ADMIN' });
});

afterAll(async () => {
  await h.stop();
});

const login = (input: { username: string; password: string }) =>
  postGraphql<{ login: { username: string; role: string; permissions: string[] } }>(h.url, LOGIN, {
    variables: { input },
  });

const auditActions = async (): Promise<string[]> =>
  (
    await querySql<{ action: string; metadata: unknown }>(
      h.db.url,
      'SELECT action, metadata FROM audit_logs ORDER BY id',
    )
  ).map((row) => `${row.action}${row.metadata === null ? '' : ` ${JSON.stringify(row.metadata)}`}`);

describe('login (F-01, SYSTEM_DESIGN.md §2.1)', () => {
  it('signs in case-insensitively and returns the viewer with role permissions', async () => {
    const response = await login({ username: 'OWNER', password: admin.password });
    expect(response.body.data?.login).toMatchObject({ username: 'owner', role: 'ADMIN' });
    expect(response.body.data?.login.permissions).toContain('staff:manage');
  });

  it('sets a __Host- session cookie: HttpOnly, Secure, SameSite=Strict, Path=/', async () => {
    const response = await fetch(`${h.url}/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: LOGIN,
        variables: { input: { username: admin.username, password: admin.password } },
      }),
    });
    const cookie = response.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/^__Host-pos_sid=[\w-]{43};/);
    for (const flag of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/']) {
      expect(cookie).toContain(flag);
    }
    expect(cookie).not.toMatch(/Domain=/i);
  });

  it('answers wrong password, unknown user and disabled user with the same error', async () => {
    const disabled = await createUser(h, { username: 'gone', status: 'DISABLED' });
    const attempts = [
      { username: 'owner', password: 'not-the-password' },
      { username: 'nobody', password: 'whatever-1234' },
      { username: 'gone', password: disabled.password },
    ];
    for (const input of attempts) {
      const response = await login(input);
      expect(errorCode(response)).toBe('UNAUTHENTICATED');
      expect(response.body.errors?.[0]?.message).toBe('Invalid username or password.');
    }
  });

  it('audits successes and failures without storing the typed username', async () => {
    const actions = await auditActions();
    expect(actions).toContain('auth.loginSucceeded');
    expect(actions).toContain('auth.loginFailed {"reason":"UNKNOWN_USER"}');
    expect(actions).toContain('auth.loginFailed {"reason":"BAD_PASSWORD"}');
    expect(actions).toContain('auth.loginFailed {"reason":"DISABLED"}');
    expect(actions.join(' ')).not.toContain('nobody');
  });

  it('rate-limits repeated attempts for one username and IP (5 per 15 min)', async () => {
    const codes: unknown[] = [];
    for (let i = 0; i < 6; i += 1) {
      codes.push(errorCode(await login({ username: 'target', password: `guess-${String(i)}` })));
    }
    expect(codes.slice(0, 5)).toEqual(Array<string>(5).fill('UNAUTHENTICATED'));
    expect(codes[5]).toBe('RATE_LIMITED');
  });
});

describe('me and logout', () => {
  it('me needs a session; logout revokes it and clears the cookie', async () => {
    expect(await whoAmI(h.url, '')).toBe('UNAUTHENTICATED');
    const cookie = await loginCookie(h.url, admin);
    expect(await whoAmI(h.url, cookie)).toBe('owner');

    const response = await fetch(`${h.url}/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ query: 'mutation { logout }' }),
    });
    expect(response.headers.get('set-cookie')).toMatch(
      /__Host-pos_sid=;.*Expires=Thu, 01 Jan 1970/,
    );
    expect(await whoAmI(h.url, cookie)).toBe('UNAUTHENTICATED');
    const [row] = await querySql<{ reason: string }>(
      h.db.url,
      "SELECT revoke_reason AS reason FROM sessions WHERE revoke_reason = 'LOGOUT'",
    );
    expect(row?.reason).toBe('LOGOUT');
  });

  it('ignores malformed or unknown cookies', async () => {
    expect(await whoAmI(h.url, '__Host-pos_sid=short')).toBe('UNAUTHENTICATED');
    expect(await whoAmI(h.url, `__Host-pos_sid=${'a'.repeat(43)}`)).toBe('UNAUTHENTICATED');
  });
});
