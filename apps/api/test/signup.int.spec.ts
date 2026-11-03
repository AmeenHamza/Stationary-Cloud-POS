import { randomBytes } from 'node:crypto';

import { GraphQLSchemaHost } from '@nestjs/graphql';
import { isInputObjectType } from 'graphql';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { querySql } from '@pos/testkit';

import { loginCookie, whoAmI } from './support/auth';
import { errorCode, postGraphql } from './support/graphql-client';
import { startHarness, type Harness } from './support/harness';
import { flushTestRedis } from './support/services';

const secret = randomBytes(32).toString('hex');
const password = randomBytes(24).toString('base64url');
const SIGN_UP = 'mutation SignUp($input: SignUpInput!) { signUp(input: $input) }';
let h: Harness;

const input = (role: 'ADMIN' | 'CASHIER' = 'CASHIER') => ({
  fullName: 'Example',
  username: `user_${randomBytes(8).toString('hex')}`,
  password,
  role,
  signupSecret: secret,
});
const signup = (value: ReturnType<typeof input>) =>
  postGraphql<{ signUp: boolean }>(h.url, SIGN_UP, { variables: { input: value } });

beforeAll(async () => {
  h = await startHarness({ env: { SIGNUP_SECRET: secret } });
});
beforeEach(async () => {
  await flushTestRedis();
});
afterAll(async () => {
  await h.stop();
});

describe('self-service signup', () => {
  it('publishes the requested Boolean mutation and input contract', () => {
    const schema = h.app.get(GraphQLSchemaHost).schema;
    expect(String(schema.getMutationType()?.getFields()['signUp']?.type)).toBe('Boolean!');
    const arg = schema.getMutationType()?.getFields()['signUp']?.args[0];
    expect(String(arg?.type)).toBe('SignUpInput!');
    const inputType = schema.getType('SignUpInput');
    expect(isInputObjectType(inputType)).toBe(true);
    if (!isInputObjectType(inputType)) throw new Error('SignUpInput is missing');
    expect(
      Object.fromEntries(
        Object.entries(inputType.getFields()).map(([name, field]) => [name, String(field.type)]),
      ),
    ).toEqual({
      fullName: 'String!',
      username: 'String!',
      password: 'String!',
      role: 'UserRole!',
      signupSecret: 'String!',
    });
  });

  it.each(['ADMIN', 'CASHIER'] as const)(
    'creates %s and permits a subsequent login',
    async (role) => {
      const account = input(role);
      const result = await fetch(`${h.url}/graphql`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: SIGN_UP, variables: { input: account } }),
      });
      expect(result.headers.get('set-cookie')).toBeNull();
      expect(await result.json()).toMatchObject({ data: { signUp: true } });
      const cookie = await loginCookie(h.url, account);
      expect(await whoAmI(h.url, cookie)).toBe(account.username);
      const rows = await querySql<{
        role: string;
        password_hash: string;
        created_by_id: string | null;
      }>(
        h.db.url,
        'SELECT role::text, password_hash, created_by_id FROM users WHERE username = $1',
        [account.username],
      );
      expect(rows[0]).toMatchObject({ role, created_by_id: null });
      expect(rows[0]?.password_hash).not.toBe(password);
      expect(rows[0]?.password_hash).toMatch(/^\$argon2/);
      const audits = await querySql<{ metadata: unknown }>(
        h.db.url,
        "SELECT metadata FROM audit_logs WHERE action = 'staff.created'",
      );
      expect(JSON.stringify(audits)).not.toContain(secret);
      expect(JSON.stringify(audits)).not.toContain(password);
    },
  );

  it('rejects bad secrets before validation and returns a conflict on duplicate usernames', async () => {
    const account = input();
    expect(
      errorCode(
        await signup({ ...account, signupSecret: randomBytes(32).toString('hex'), password: '' }),
      ),
    ).toBe('UNAUTHENTICATED');
    expect(errorCode(await signup({ ...account, password: 'x' }))).toBe('BAD_USER_INPUT');
    expect((await signup(account)).body.data?.signUp).toBe(true);
    expect(errorCode(await signup(account))).toBe('CONFLICT');
  });

  it('rate-limits attempts independently of the username', async () => {
    for (let n = 0; n < 5; n += 1) {
      expect(
        errorCode(await signup({ ...input(), signupSecret: randomBytes(32).toString('hex') })),
      ).toBe('UNAUTHENTICATED');
    }
    expect(errorCode(await signup(input()))).toBe('RATE_LIMITED');
  });

  it('fails closed when Redis is unavailable', async () => {
    await h.cutRedis();
    expect(errorCode(await signup(input()))).toBe('RATE_LIMITED');
  });
});
