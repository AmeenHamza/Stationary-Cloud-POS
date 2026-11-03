import { Injectable } from '@nestjs/common';

import { UnitOfWork } from '../../../infrastructure/unit-of-work/unit-of-work';
import { AuditService } from '../../audit';

import { SessionRevocationService } from './session-revocation.service';

import type { Principal } from '../../../common/auth/principal';

/** `logout` (F-01): revokes the current session only (SYSTEM_DESIGN.md §2.3). */
@Injectable()
export class LogoutService {
  constructor(
    private readonly revocation: SessionRevocationService,
    private readonly audit: AuditService,
    private readonly uow: UnitOfWork,
  ) {}

  execute(viewer: Principal): Promise<void> {
    return this.uow.run(async () => {
      await this.revocation.revoke({ sessionId: viewer.sessionId }, 'LOGOUT');
      await this.audit.record('auth.logout', viewer.userId, {
        entityType: 'user',
        entityId: viewer.userId,
      });
    });
  }
}
