import { Injectable } from '@nestjs/common';

import { ClockService } from '../../../common/time/clock.service';
import { RateLimiterService } from '../../../infrastructure/rate-limit/rate-limiter.service';
import { UnitOfWork } from '../../../infrastructure/unit-of-work/unit-of-work';
import { AuditService } from '../../audit';
import { PasswordHasher, SessionRevocationService } from '../../auth';
import { StaffRepository, type StaffRow } from '../persistence/staff.repository';

import { lockedTarget } from './staff-change';

import type { Principal } from '../../../common/auth/principal';
import type { ResetStaffPasswordInput } from '@pos/validation';

/**
 * `resetStaffPassword` (F-31): an admin sets a new password; every session of that user is revoked
 * so the old password stops working everywhere. Rate-limited with the `password` bucket.
 */
@Injectable()
export class ResetStaffPasswordService {
  constructor(
    private readonly staff: StaffRepository,
    private readonly hasher: PasswordHasher,
    private readonly revocation: SessionRevocationService,
    private readonly limiter: RateLimiterService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
    private readonly uow: UnitOfWork,
  ) {}

  async execute(input: ResetStaffPasswordInput, viewer: Principal): Promise<StaffRow> {
    await this.limiter.consume('password', viewer.userId);
    const passwordHash = await this.hasher.hash(input.newPassword);
    return this.uow.run(async () => {
      lockedTarget(await this.staff.lockForChange(input.id), input.id);
      const user = await this.staff.update(input.id, {
        passwordHash,
        passwordChangedAt: this.clock.now(),
      });
      await this.revocation.revoke({ userId: input.id }, 'ADMIN_RESET');
      await this.audit.record('staff.passwordReset', viewer.userId, {
        entityType: 'user',
        entityId: input.id,
      });
      return user;
    });
  }
}
