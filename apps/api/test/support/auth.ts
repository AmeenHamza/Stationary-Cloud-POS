import { randomBytes } from 'node:crypto';

import { PRISMA_CLIENT, type AppPrismaClient } from '../../src/infrastructure/prisma/prisma.module';
import { PasswordHasher } from '../../src/modules/auth';

import { errorCode, postGraphql } from './graphql-client';

import type { Harness } from './harness';
import type { UserRole, UserStatus } from '@pos/contracts';

export interface TestUser {
  id: string;
  username: string;
  password: string;
}

/** Inserts a staff account directly (fixture), with a random password unless one is given. */
export async function createUser(
  h: Harness,
  input: { username: string; role?: UserRole; status?: UserStatus; password?: string },
): Promise<TestUser> {
  const password = input.password ?? `pw-${randomBytes(9).toString('base64url')}`;
  const passwordHash = await h.app.get(PasswordHasher).hash(password);
  const prisma = h.app.get<AppPrismaClient>(PRISMA_CLIENT);
  const user = await prisma.user.create({
    data: {
      username: input.username,
      fullName: `Test ${input.username}`,
      role: input.role ?? 'CASHIER',
      status: input.status ?? 'ACTIVE',
      passwordHash,
    },
    select: { id: true },
  });
  return { id: user.id, username: input.username, password };
}

export const LOGIN = `mutation Login($input: LoginInput!) {
  login(input: $input) { id username fullName role permissions }
}`;

/** Logs in over HTTP and returns the `Cookie` header value for later requests. */
export async function loginCookie(
  baseUrl: string,
  user: { username: string; password: string },
): Promise<string> {
  const input = { username: user.username, password: user.password };
  const response = await fetch(`${baseUrl}/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: LOGIN, variables: { input } }),
  });
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  if (response.status !== 200 || cookie === undefined) {
    throw new Error(`login failed for ${user.username}: ${String(response.status)}`);
  }
  return cookie;
}

/** `me` with the given cookie: the username, or the error code. */
export async function whoAmI(baseUrl: string, cookie: string): Promise<unknown> {
  const response = await postGraphql<{ me: { username: string } }>(baseUrl, '{ me { username } }', {
    headers: { cookie },
  });
  return response.body.data?.me.username ?? errorCode(response);
}
