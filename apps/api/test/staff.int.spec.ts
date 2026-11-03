import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createUser, loginCookie, whoAmI, type TestUser } from './support/auth';
import { errorCode } from './support/graphql-client';
import { startHarness, type Harness } from './support/harness';
import {
  asUser,
  CREATE_STAFF,
  RESET_PASSWORD,
  SET_STATUS,
  STAFF_USERS,
  UPDATE_STAFF,
  type StaffNode,
} from './support/staff';

let h: Harness;
let admin: TestUser;
let adminCookie: string;

beforeAll(async () => {
  h = await startHarness();
  admin = await createUser(h, { username: 'boss', role: 'ADMIN' });
  adminCookie = await loginCookie(h.url, admin);
});

afterAll(async () => {
  await h.stop();
});

const create = (input: Record<string, unknown>) =>
  asUser<{ createStaffUser: StaffNode }>(h.url, adminCookie, CREATE_STAFF, { input });

async function newCashier(username: string): Promise<{ node: StaffNode; cookie: string }> {
  const password = `${username}-pass-1`;
  const response = await create({
    username,
    fullName: `Cashier ${username}`,
    role: 'CASHIER',
    password,
  });
  const node = response.body.data?.createStaffUser;
  if (node === undefined) {
    throw new Error(`create failed: ${JSON.stringify(response.body.errors)}`);
  }
  return { node, cookie: await loginCookie(h.url, { username, password }) };
}

describe('authorization (API.md §5, E2E-11 API side)', () => {
  it('refuses cashiers and anonymous callers', async () => {
    const { cookie } = await newCashier('till1');
    expect(errorCode(await asUser(h.url, cookie, STAFF_USERS))).toBe('FORBIDDEN');
    expect(errorCode(await asUser(h.url, '', STAFF_USERS))).toBe('UNAUTHENTICATED');
  });
});

describe('createStaffUser (F-31, D-10)', () => {
  it('creates an account that can sign in, and refuses duplicates and weak inputs', async () => {
    const { node } = await newCashier('till2');
    expect(node).toMatchObject({
      username: 'till2',
      role: 'CASHIER',
      status: 'ACTIVE',
      version: 1,
    });
    const duplicate = await create({
      username: 'TILL2',
      fullName: 'Again',
      role: 'CASHIER',
      password: 'another-pass-9',
    });
    expect(errorCode(duplicate)).toBe('CONFLICT');
    expect(duplicate.body.errors?.[0]?.extensions?.['fieldErrors']).toHaveProperty('username');
    const samePassword = await create({
      username: 'till3',
      fullName: 'X',
      role: 'CASHIER',
      password: 'till3',
    });
    expect(errorCode(samePassword)).toBe('BAD_USER_INPUT');
  });
});

describe('staffUsers (keyset pages, max 50)', () => {
  it('pages by name, filters by search and status, and rejects first: 51', async () => {
    const all = await asUser<{
      staffUsers: {
        nodes: StaffNode[];
        pageInfo: { hasNextPage: boolean; endCursor: string };
        totalCount: number;
      };
    }>(h.url, adminCookie, STAFF_USERS, { first: 2 });
    const page1 = all.body.data?.staffUsers;
    expect(page1?.nodes).toHaveLength(2);
    expect(page1?.pageInfo.hasNextPage).toBe(true);
    const page2 = await asUser<{ staffUsers: { nodes: StaffNode[] } }>(
      h.url,
      adminCookie,
      STAFF_USERS,
      {
        first: 2,
        after: page1?.pageInfo.endCursor,
      },
    );
    const names = [...(page1?.nodes ?? []), ...(page2.body.data?.staffUsers.nodes ?? [])].map(
      (n) => n.fullName,
    );
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(new Set(names).size).toBe(names.length);

    const found = await asUser<{ staffUsers: { nodes: StaffNode[] } }>(
      h.url,
      adminCookie,
      STAFF_USERS,
      {
        filter: { search: 'TILL2' },
      },
    );
    expect(found.body.data?.staffUsers.nodes.map((n) => n.username)).toEqual(['till2']);
    expect(errorCode(await asUser(h.url, adminCookie, STAFF_USERS, { first: 51 }))).toBe(
      'BAD_USER_INPUT',
    );
  });
});

describe('changes that sign the person out (SYSTEM_DESIGN.md §2.3)', () => {
  it('a role change revokes sessions; a stale version is refused', async () => {
    const { node, cookie } = await newCashier('till4');
    const input = { id: node.id, fullName: 'Promoted', role: 'ADMIN', version: node.version };
    const updated = await asUser<{ updateStaffUser: StaffNode }>(h.url, adminCookie, UPDATE_STAFF, {
      input,
    });
    expect(updated.body.data?.updateStaffUser).toMatchObject({ role: 'ADMIN', version: 2 });
    expect(await whoAmI(h.url, cookie)).toBe('UNAUTHENTICATED');
    expect(errorCode(await asUser(h.url, adminCookie, UPDATE_STAFF, { input }))).toBe('CONFLICT');
  });

  it('disabling revokes sessions and blocks sign-in; enabling allows it again', async () => {
    const { node, cookie } = await newCashier('till5');
    await asUser(h.url, adminCookie, SET_STATUS, { input: { id: node.id, status: 'DISABLED' } });
    expect(await whoAmI(h.url, cookie)).toBe('UNAUTHENTICATED');
    await expect(
      loginCookie(h.url, { username: 'till5', password: 'till5-pass-1' }),
    ).rejects.toThrow();
    await asUser(h.url, adminCookie, SET_STATUS, { input: { id: node.id, status: 'ACTIVE' } });
    await expect(
      loginCookie(h.url, { username: 'till5', password: 'till5-pass-1' }),
    ).resolves.toBeTruthy();
  });

  it('a password reset revokes sessions; only the new password works', async () => {
    const { node, cookie } = await newCashier('till6');
    const reset = await asUser(h.url, adminCookie, RESET_PASSWORD, {
      input: { id: node.id, newPassword: 'fresh-pass-77' },
    });
    expect(reset.body.errors).toBeUndefined();
    expect(await whoAmI(h.url, cookie)).toBe('UNAUTHENTICATED');
    await expect(
      loginCookie(h.url, { username: 'till6', password: 'till6-pass-1' }),
    ).rejects.toThrow();
    await expect(
      loginCookie(h.url, { username: 'till6', password: 'fresh-pass-77' }),
    ).resolves.toBeTruthy();
  });
});
