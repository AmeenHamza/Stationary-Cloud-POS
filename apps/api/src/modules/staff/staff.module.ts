import { Module } from '@nestjs/common';

import { AuditModule } from '../audit';
import { AuthModule } from '../auth';

import { BootstrapAdminService } from './application/bootstrap-admin.service';
import { CreateStaffUserService } from './application/create-staff-user.service';
import { DeleteStaffUserService } from './application/delete-staff-user.service';
import { ResetStaffPasswordService } from './application/reset-staff-password.service';
import { SetStaffStatusService } from './application/set-staff-status.service';
import { SignUpService } from './application/sign-up.service';
import { StaffQueriesService } from './application/staff-queries.service';
import { UpdateStaffUserService } from './application/update-staff-user.service';
import { SignUpResolver } from './graphql/sign-up.resolver';
import { StaffResolver } from './graphql/staff.resolver';
import { StaffRepository } from './persistence/staff.repository';

/** Staff accounts (F-31, D-10). Uses auth for password hashing and session revocation. */
@Module({
  imports: [AuditModule, AuthModule],
  providers: [
    StaffResolver,
    SignUpResolver,
    SignUpService,
    StaffQueriesService,
    CreateStaffUserService,
    UpdateStaffUserService,
    SetStaffStatusService,
    ResetStaffPasswordService,
    DeleteStaffUserService,
    BootstrapAdminService,
    StaffRepository,
  ],
  exports: [BootstrapAdminService],
})
export class StaffModule {}
