import { AppError } from '../../../common/errors/app-error';

import type { LockedUser } from '../persistence/staff.repository';
import type { UserRole, UserStatus } from '@pos/contracts';

/**
 * Checks shared by staff changes, run on rows locked by `StaffRepository.lockForChange`
 * (DATABASE.md §4.1 invariant: at least one ACTIVE ADMIN always exists).
 */
export function lockedTarget(rows: readonly LockedUser[], userId: string): LockedUser {
  const target = rows.find((row) => row.id === userId);
  if (target === undefined) {
    throw new AppError('NOT_FOUND', 'This staff account does not exist.');
  }
  return target;
}

export function assertVersion(target: LockedUser, version: number): void {
  if (target.version !== version) {
    throw new AppError('CONFLICT', 'Someone else changed this account. Reload and try again.');
  }
}

/** Refuses a change that would leave no active admin. */
export function assertKeepsAnAdmin(
  rows: readonly LockedUser[],
  target: LockedUser,
  next: { role: UserRole; status: UserStatus },
): void {
  const targetIsActiveAdmin = target.role === 'ADMIN' && target.status === 'ACTIVE';
  const staysActiveAdmin = next.role === 'ADMIN' && next.status === 'ACTIVE';
  const activeAdmins = rows.filter((row) => row.role === 'ADMIN' && row.status === 'ACTIVE');
  if (targetIsActiveAdmin && !staysActiveAdmin && activeAdmins.length <= 1) {
    throw new AppError('LAST_ADMIN', 'At least one active admin must remain.');
  }
}
