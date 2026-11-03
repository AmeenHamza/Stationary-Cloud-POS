import { Injectable } from '@nestjs/common';

import { UnitOfWork } from '../../../infrastructure/unit-of-work/unit-of-work';
import { AuditService } from '../../audit';
import { SessionRevocationService } from '../../auth';
import { StaffRepository, type StaffRow } from '../persistence/staff.repository';

import { assertKeepsAnAdmin, lockedTarget } from './staff-change';

import type { Principal } from '../../../common/auth/principal';
import type { SetStaffUserStatusInput } from '@pos/validation';

/**
 * `setStaffUserStatus` (F-31): disabling revokes every session of that user, which also closes their
 * sockets (`session.revoked`); the last active admin cannot be disabled (LAST_ADMIN).
 */
@Injectable()
export class SetStaffStatusService {
  constructor(
    private readonly staff: StaffRepository,
    private readonly revocation: SessionRevocationService,
    private readonly audit: AuditService,
    private readonly uow: UnitOfWork,
  ) {}

  execute(input: SetStaffUserStatusInput, viewer: Principal): Promise<StaffRow> {
    return this.uow.run(async () => {
      const locked = await this.staff.lockForChange(input.id);
      const target = lockedTarget(locked, input.id);
      assertKeepsAnAdmin(locked, target, { role: target.role, status: input.status });

      const user = await this.staff.update(input.id, { status: input.status });
      if (input.status === 'DISABLED') {
        await this.revocation.revoke({ userId: input.id }, 'DISABLED');
      }
      if (target.status !== input.status) {
        await this.audit.record('staff.statusChanged', viewer.userId, {
          entityType: 'user',
          entityId: input.id,
          metadata: { from: target.status, to: input.status },
        });
      }
      return user;
    });
  }
}
