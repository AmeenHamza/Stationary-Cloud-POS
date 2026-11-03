import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import { ClockService } from '../../../common/time/clock.service';
import { RateLimiterService } from '../../../infrastructure/rate-limit/rate-limiter.service';
import { UnitOfWork } from '../../../infrastructure/unit-of-work/unit-of-work';
import { AuditService } from '../../audit';
import { AuthUsersRepository } from '../persistence/auth-users.repository';

import { PasswordHasher } from './password-hasher';
import { SessionRevocationService } from './session-revocation.service';

import type { Principal } from '../../../common/auth/principal';
import type { ChangePasswordInput } from '@pos/validation';

/**
 * `changePassword` (F-03): checks the current password, stores the new hash and revokes the user's
 * other sessions; this one stays signed in (SYSTEM_DESIGN.md §2.3). Rate-limited per user.
 */
@Injectable()
export class ChangePasswordService {
  constructor(
    private readonly users: AuthUsersRepository,
    private readonly hasher: PasswordHasher,
    private readonly revocation: SessionRevocationService,
    private readonly limiter: RateLimiterService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
    private readonly uow: UnitOfWork,
  ) {}

  async execute(input: ChangePasswordInput, viewer: Principal): Promise<void> {
    await this.limiter.consume('password', viewer.userId);
    const current = await this.users.findPasswordHash(viewer.userId);
    if (
      current === null ||
      !(await this.hasher.verify(current.passwordHash, input.currentPassword))
    ) {
      throw new AppError('BAD_USER_INPUT', 'Some fields are invalid.', {
        fieldErrors: { currentPassword: 'The current password is not correct' },
      });
    }
    const passwordHash = await this.hasher.hash(input.newPassword);
    await this.uow.run(async () => {
      await this.users.setPassword(viewer.userId, passwordHash, this.clock.now());
      await this.revocation.revoke(
        { userId: viewer.userId, exceptSessionId: viewer.sessionId },
        'PASSWORD_CHANGED',
      );
      await this.audit.record('auth.passwordChanged', viewer.userId, {
        entityType: 'user',
        entityId: viewer.userId,
      });
    });
  }
}
