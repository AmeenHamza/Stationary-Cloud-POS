import { describe, expect, it } from 'vitest';

import { createUser, loginCookie, whoAmI } from './support/auth';
import { dataOf, errorCode } from './support/graphql-client';
import { startHarness, type Harness } from './support/harness';
import { useRoles } from './support/roles';
import * as sales from './support/sales';
import { asUser, CREATE_STAFF, expectOneAdminLeft } from './support/staff';

const t = useRoles();

const DELETE_STAFF = 'mutation D($id: ID!) { deleteStaffUser(id: $id) }';

const remove = (id: string, cookie = t.admin, url = t.h.url) =>
  asUser<{ deleteStaffUser: boolean }>(url, cookie, DELETE_STAFF, { id });

const accountExists = async (id: string): Promise<boolean> =>
  (await t.prisma.user.findUnique({ where: { id }, select: { id: true } })) !== null;

async function signedIn(h: Harness, username: string, role: 'ADMIN' | 'CASHIER') {
  const user = await createUser(h, { username, role });
  return { user, cookie: await loginCookie(h.url, user) };
}

describe('deleteStaffUser (D-28)', () => {
  it('removes an account that only signed in, ends its session and keeps the sign-in log', async () => {
    const { user, cookie } = await signedIn(t.h, 'temp.till', 'CASHIER');
    expect(await t.prisma.session.count({ where: { userId: user.id } })).toBe(1);
    const logins = await t.prisma.auditLog.count({
      where: { actorUserId: user.id, action: 'auth.loginSucceeded' },
    });
    expect(logins).toBe(1);

    expect(dataOf(await remove(user.id)).deleteStaffUser).toBe(true);

    expect(await accountExists(user.id)).toBe(false);
    expect(await t.prisma.session.count({ where: { userId: user.id } })).toBe(0);
    expect(await t.prisma.auditLog.count({ where: { actorUserId: user.id } })).toBe(0);
    const audit = await t.prisma.auditLog.findFirst({
      where: { action: 'staff.deleted', entityId: user.id },
      select: { metadata: true },
    });
    expect(audit?.metadata).toEqual({ role: 'CASHIER' });
    expect(await whoAmI(t.h.url, cookie)).toBe('UNAUTHENTICATED');
    expect(errorCode(await remove(user.id))).toBe('NOT_FOUND');
  });

  it('refuses an account with a bill: it can only be disabled (D-12)', async () => {
    const { user, cookie } = await signedIn(t.h, 'busy.till', 'CASHIER');
    const productId = await sales.seedProduct(t.prisma, { price: '10' });
    const input = sales.saleInput([{ productId }], { expectedTotal: '10.00' });
    dataOf(await asUser<sales.SaleResult>(t.h.url, cookie, sales.CREATE_SALE, { input }));

    expect(errorCode(await remove(user.id))).toBe('HAS_HISTORY');

    expect(await accountExists(user.id)).toBe(true);
    expect(await whoAmI(t.h.url, cookie)).toBe('busy.till');
  });

  it('refuses an admin who managed anything, so the audit log keeps their name', async () => {
    const { user, cookie } = await signedIn(t.h, 'second.admin', 'ADMIN');
    dataOf(
      await asUser(t.h.url, cookie, CREATE_STAFF, {
        input: {
          username: 'made.by.second',
          fullName: 'Made',
          role: 'CASHIER',
          password: 'made-by-second-1',
        },
      }),
    );
    expect(errorCode(await remove(user.id))).toBe('HAS_HISTORY');
    expect(await accountExists(user.id)).toBe(true);
  });

  it('refuses your own account, and cashiers', async () => {
    const { user, cookie } = await signedIn(t.h, 'self.admin', 'ADMIN');
    expect(errorCode(await remove(user.id, cookie))).toBe('CONFLICT');
    expect(await accountExists(user.id)).toBe(true);
    const { user: other } = await signedIn(t.h, 'other.till', 'CASHIER');
    expect(errorCode(await remove(other.id, t.cashier))).toBe('FORBIDDEN');
  });
});

describe('deleting admins (DATABASE.md §4.1 invariant)', () => {
  it('two admins deleting each other at once: exactly one account goes', async () => {
    const pair = await startHarness();
    try {
      const a = await signedIn(pair, 'adm.a', 'ADMIN');
      const b = await signedIn(pair, 'adm.b', 'ADMIN');
      const results = await Promise.all([
        remove(b.user.id, a.cookie, pair.url),
        remove(a.user.id, b.cookie, pair.url),
      ]);
      await expectOneAdminLeft(pair.db.url, results);
    } finally {
      await pair.stop();
    }
  });
});
