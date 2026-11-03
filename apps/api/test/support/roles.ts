import { afterAll, beforeAll } from 'vitest';

import { PRISMA_CLIENT, type AppPrismaClient } from '../../src/infrastructure/prisma/prisma.module';

import { createUser, loginCookie } from './auth';
import { startHarness, type Harness } from './harness';

/** A running API with a signed-in admin and cashier (their cookies) and direct database access. */
export interface RoleHarness {
  h: Harness;
  prisma: AppPrismaClient;
  admin: string;
  cashier: string;
}

/**
 * Registers the suite's hooks and returns an object the tests read once they run: the harness is
 * started and both roles signed in before the first test, and stopped after the last. `env` is read
 * when the harness starts, e.g. a stub URL known only after the stub's own `beforeAll`.
 */
export function useRoles(
  options: { env?: () => Readonly<Record<string, string>> } = {},
): RoleHarness {
  const roles = {} as RoleHarness; // filled in beforeAll, before any test reads it
  beforeAll(async () => {
    const h = await startHarness(options.env === undefined ? {} : { env: options.env() });
    roles.h = h;
    roles.prisma = h.app.get<AppPrismaClient>(PRISMA_CLIENT);
    roles.admin = await loginCookie(
      h.url,
      await createUser(h, { username: 'owner', role: 'ADMIN' }),
    );
    roles.cashier = await loginCookie(
      h.url,
      await createUser(h, { username: 'till', role: 'CASHIER' }),
    );
  });
  afterAll(async () => {
    await roles.h.stop();
  });
  return roles;
}
