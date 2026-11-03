import { describe, expect, it } from 'vitest';

import { querySql } from '@pos/testkit';

import { createUser, loginCookie } from './support/auth';
import { errorCode } from './support/graphql-client';
import { startHarness } from './support/harness';
import { asUser, SET_STATUS, UPDATE_STAFF } from './support/staff';

describe('last active admin (DATABASE.md §4.1)', () => {
  it('cannot be disabled or demoted', async () => {
    const solo = await startHarness();
    try {
      const only = await createUser(solo, { username: 'solo', role: 'ADMIN' });
      const cookie = await loginCookie(solo.url, only);
      const disable = await asUser(solo.url, cookie, SET_STATUS, {
        input: { id: only.id, status: 'DISABLED' },
      });
      expect(errorCode(disable)).toBe('LAST_ADMIN');
      const demote = await asUser(solo.url, cookie, UPDATE_STAFF, {
        input: { id: only.id, fullName: 'Solo', role: 'CASHIER', version: 1 },
      });
      expect(errorCode(demote)).toBe('LAST_ADMIN');
    } finally {
      await solo.stop();
    }
  });

  it('two admins disabling each other at once: exactly one succeeds', async () => {
    const pair = await startHarness();
    try {
      const a = await createUser(pair, { username: 'adm.a', role: 'ADMIN' });
      const b = await createUser(pair, { username: 'adm.b', role: 'ADMIN' });
      const [cookieA, cookieB] = await Promise.all([
        loginCookie(pair.url, a),
        loginCookie(pair.url, b),
      ]);
      const results = await Promise.all([
        asUser(pair.url, cookieA, SET_STATUS, { input: { id: b.id, status: 'DISABLED' } }),
        asUser(pair.url, cookieB, SET_STATUS, { input: { id: a.id, status: 'DISABLED' } }),
      ]);
      const codes = results.map((r) => errorCode(r) ?? 'OK');
      expect(codes.filter((code) => code === 'OK')).toHaveLength(1);
      // The loser sees LAST_ADMIN, or UNAUTHENTICATED if the winner's commit already signed them out.
      expect(codes.filter((code) => code !== 'OK')).toEqual([
        expect.stringMatching(/^(LAST_ADMIN|UNAUTHENTICATED)$/),
      ]);
      const [row] = await querySql<{ n: string }>(
        pair.db.url,
        "SELECT count(*)::text AS n FROM users WHERE role = 'ADMIN' AND status = 'ACTIVE'",
      );
      expect(row?.n).toBe('1');
    } finally {
      await pair.stop();
    }
  });
});
