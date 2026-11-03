import { Injectable } from '@nestjs/common';

import { keysetOrderBy, keysetWhere, type KeysetSort } from '../../../common/pagination/keyset';
import { TransactionalClient } from '../../../infrastructure/prisma/transactional-client';

import type { UserRole, UserStatus } from '@pos/contracts';
import type { Prisma } from '@pos/database';

export interface NewStaffUser {
  username: string;
  fullName: string;
  role: UserRole;
  passwordHash: string;
  createdById: string | null;
}

export const STAFF_SELECT = {
  id: true,
  username: true,
  fullName: true,
  role: true,
  status: true,
  version: true,
  createdAt: true,
} as const satisfies Prisma.UserSelect;

export type StaffRow = Prisma.UserGetPayload<{ select: typeof STAFF_SELECT }>;

export interface LockedUser {
  id: string;
  role: UserRole;
  status: UserStatus;
  version: number;
}

export const STAFF_SORT: KeysetSort = { name: 'NAME_ASC', field: 'fullName', direction: 'asc' };

export interface StaffFilter {
  search?: string | null | undefined;
  status?: UserStatus | null | undefined;
}

function filterWhere(filter: StaffFilter): Prisma.UserWhereInput {
  const search = filter.search ?? undefined;
  return {
    ...(filter.status == null ? {} : { status: filter.status }),
    ...(search === undefined
      ? {}
      : {
          OR: [
            { username: { contains: search, mode: 'insensitive' } },
            { fullName: { contains: search, mode: 'insensitive' } },
          ],
        }),
  };
}

/** Persistence for staff accounts in `users` (DATABASE.md §4.1). */
@Injectable()
export class StaffRepository {
  constructor(private readonly db: TransactionalClient) {}

  async insert(user: NewStaffUser): Promise<StaffRow> {
    return this.db.client.user.create({ data: user, select: STAFF_SELECT });
  }

  /** One page by full name, then id (keyset; `take` is first + 1 to detect a next page). */
  list(filter: StaffFilter, take: number, after: string | null | undefined): Promise<StaffRow[]> {
    const cursor = keysetWhere(STAFF_SORT, after) as Prisma.UserWhereInput | undefined;
    return this.db.client.user.findMany({
      where: { AND: [filterWhere(filter), ...(cursor === undefined ? [] : [cursor])] },
      orderBy: keysetOrderBy(STAFF_SORT),
      take,
      select: STAFF_SELECT,
    });
  }

  count(filter: StaffFilter): Promise<number> {
    return this.db.client.user.count({ where: filterWhere(filter) });
  }

  countActiveAdmins(): Promise<number> {
    return this.db.client.user.count({ where: { role: 'ADMIN', status: 'ACTIVE' } });
  }

  /**
   * Locks the target and every active admin, in ascending id order (DATABASE.md §6), so concurrent
   * demotions or disables cannot both pass the last-admin check.
   */
  lockForChange(userId: string): Promise<LockedUser[]> {
    return this.db.client.$queryRaw<LockedUser[]>`
      SELECT id, role::text AS role, status::text AS status, version FROM users
      WHERE id = ${userId}::uuid OR (role = 'ADMIN' AND status = 'ACTIVE')
      ORDER BY id FOR UPDATE`;
  }

  update(userId: string, data: Prisma.UserUpdateInput): Promise<StaffRow> {
    return this.db.client.user.update({
      where: { id: userId },
      data: { ...data, version: { increment: 1 } },
      select: STAFF_SELECT,
    });
  }
}
