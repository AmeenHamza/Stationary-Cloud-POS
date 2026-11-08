import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import { UnitOfWork } from '../../../infrastructure/unit-of-work/unit-of-work';
import { AuditService } from '../../audit';
import { SessionRevocationService } from '../../auth';
import { StaffRepository } from '../persistence/staff.repository';

import { assertKeepsAnAdmin, lockedTarget } from './staff-change';

import type { Principal } from '../../../common/auth/principal';

/**
 * `deleteStaffUser` (D-28): removes an account from the database if it did no work the shop must
 * keep a name against; otherwise `HAS_HISTORY`, and the account can only be disabled. An admin cannot
 * delete their own account, nor the last active admin (LAST_ADMIN). Revoking first closes the
 * person's sockets and tombstones their cached sessions (SYSTEM_DESIGN.md §2.3).
 */
@Injectable()
export class DeleteStaffUserService {
  constructor(
    private readonly staff: StaffRepository,
    private readonly revocation: SessionRevocationService,
    private readonly audit: AuditService,
    private readonly uow: UnitOfWork,
  ) {}

  execute(id: string, viewer: Principal): Promise<boolean> {
    if (id === viewer.userId) {
      throw new AppError('CONFLICT', 'You cannot delete your own account.');
    }
    return this.uow.run(async () => {
      const locked = await this.staff.lockForChange(id);
      const target = lockedTarget(locked, id);
      assertKeepsAnAdmin(locked, target, { role: target.role, status: 'DISABLED' });
      if (await this.staff.hasWorkHistory(id)) {
        throw new AppError(
          'HAS_HISTORY',
          'This account has bills or other work on record, so it cannot be deleted. Disable it instead.',
        );
      }
      await this.revocation.revoke({ userId: id }, 'DISABLED');
      await this.staff.deleteAccount(id);
      await this.audit.record('staff.deleted', viewer.userId, {
        entityType: 'user',
        entityId: id,
        metadata: { role: target.role },
      });
      return true;
    });
  }
}
