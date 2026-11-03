import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import { isUniqueViolation } from '../../../common/errors/prisma-error.mapper';
import { UnitOfWork } from '../../../infrastructure/unit-of-work/unit-of-work';
import { AuditService } from '../../audit';
import { PasswordHasher } from '../../auth';
import { StaffRepository, type StaffRow } from '../persistence/staff.repository';

import type { Principal } from '../../../common/auth/principal';
import type { CreateStaffUserInput } from '@pos/validation';

/** Creates staff accounts and records the actor or the self-service origin. */
@Injectable()
export class CreateStaffUserService {
  constructor(
    private readonly staff: StaffRepository,
    private readonly hasher: PasswordHasher,
    private readonly audit: AuditService,
    private readonly uow: UnitOfWork,
  ) {}

  async execute(input: CreateStaffUserInput, viewer: Principal | null): Promise<StaffRow> {
    const passwordHash = await this.hasher.hash(input.password);
    try {
      return await this.uow.run(async () => {
        const user = await this.staff.insert({
          username: input.username,
          fullName: input.fullName,
          role: input.role,
          passwordHash,
          createdById: viewer?.userId ?? null,
        });
        await this.audit.record('staff.created', viewer?.userId ?? null, {
          entityType: 'user',
          entityId: user.id,
          metadata: { role: user.role, ...(viewer === null ? { via: 'signup' } : {}) },
        });
        return user;
      });
    } catch (error) {
      if (isUniqueViolation(error, 'username')) {
        throw new AppError('CONFLICT', 'Some fields are invalid.', {
          fieldErrors: { username: 'This username is already taken' },
        });
      }
      throw error;
    }
  }
}
