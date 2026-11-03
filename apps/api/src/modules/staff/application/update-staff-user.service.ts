import { Injectable } from '@nestjs/common';

import { UnitOfWork } from '../../../infrastructure/unit-of-work/unit-of-work';
import { AuditService } from '../../audit';
import { SessionRevocationService } from '../../auth';
import { StaffRepository, type StaffRow } from '../persistence/staff.repository';

import { assertKeepsAnAdmin, assertVersion, lockedTarget } from './staff-change';

import type { Principal } from '../../../common/auth/principal';
import type { UpdateStaffUserInput } from '@pos/validation';

/**
 * `updateStaffUser` [V] (F-31): name and role. A role change revokes that user's sessions so the new
 * permissions apply at once; demoting the last active admin is refused.
 */
@Injectable()
export class UpdateStaffUserService {
  constructor(
    private readonly staff: StaffRepository,
    private readonly revocation: SessionRevocationService,
    private readonly audit: AuditService,
    private readonly uow: UnitOfWork,
  ) {}

  execute(input: UpdateStaffUserInput, viewer: Principal): Promise<StaffRow> {
    return this.uow.run(async () => {
      const locked = await this.staff.lockForChange(input.id);
      const target = lockedTarget(locked, input.id);
      assertVersion(target, input.version);
      assertKeepsAnAdmin(locked, target, { role: input.role, status: target.status });

      const user = await this.staff.update(input.id, {
        fullName: input.fullName,
        role: input.role,
      });
      const roleChanged = target.role !== input.role;
      if (roleChanged) {
        await this.revocation.revoke({ userId: input.id }, 'ROLE_CHANGED');
      }
      await this.audit.record('staff.updated', viewer.userId, {
        entityType: 'user',
        entityId: input.id,
        metadata: roleChanged
          ? { role: { from: target.role, to: input.role } }
          : { fullName: true },
      });
      return user;
    });
  }
}
