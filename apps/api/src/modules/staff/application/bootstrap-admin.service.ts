import { Injectable } from '@nestjs/common';

import { createStaffUserInputSchema } from '@pos/validation';

import { AppError } from '../../../common/errors/app-error';
import { toFieldErrors } from '../../../common/validation/zod-validation.pipe';
import { UnitOfWork } from '../../../infrastructure/unit-of-work/unit-of-work';
import { AuditService } from '../../audit';
import { PasswordHasher } from '../../auth';
import { StaffRepository } from '../persistence/staff.repository';

export interface BootstrapAdminInput {
  username: string;
  fullName: string;
  password: string;
}

/**
 * Creates the first admin from `cli/create-admin.ts`. Refuses when an active admin exists.
 */
@Injectable()
export class BootstrapAdminService {
  constructor(
    private readonly staff: StaffRepository,
    private readonly hasher: PasswordHasher,
    private readonly audit: AuditService,
    private readonly uow: UnitOfWork,
  ) {}

  async execute(input: BootstrapAdminInput): Promise<string> {
    const parsed = createStaffUserInputSchema.safeParse({ ...input, role: 'ADMIN' });
    if (!parsed.success) {
      throw new AppError('BAD_USER_INPUT', 'Some fields are invalid.', {
        fieldErrors: toFieldErrors(parsed.error),
      });
    }
    const { username, fullName, password } = parsed.data;
    const passwordHash = await this.hasher.hash(password);
    return this.uow.run(async () => {
      if ((await this.staff.countActiveAdmins()) > 0) {
        throw new AppError('CONFLICT', 'An active admin already exists. Add accounts from Staff.');
      }
      const { id } = await this.staff.insert({
        username,
        fullName,
        role: 'ADMIN',
        passwordHash,
        createdById: null,
      });
      await this.audit.record('staff.created', null, {
        entityType: 'user',
        entityId: id,
        metadata: { role: 'ADMIN', via: 'cli' },
      });
      return id;
    });
  }
}
