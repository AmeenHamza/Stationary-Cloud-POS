import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import * as schemas from '@pos/validation';

import { RequirePermission } from '../../../common/auth/access-policy';
import { CurrentViewer } from '../../../common/auth/current-viewer.decorator';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { CreateStaffUserService } from '../application/create-staff-user.service';
import { DeleteStaffUserService } from '../application/delete-staff-user.service';
import { ResetStaffPasswordService } from '../application/reset-staff-password.service';
import { SetStaffStatusService } from '../application/set-staff-status.service';
import { StaffQueriesService } from '../application/staff-queries.service';
import { UpdateStaffUserService } from '../application/update-staff-user.service';

import { StaffUser, StaffUserConnection } from './staff-user.type';
import * as inputs from './staff.inputs';

import type { Principal } from '../../../common/auth/principal';
import type { ConnectionValue } from '../../../common/pagination/connection.factory';

/** Staff management (F-31, API.md §6): admins only. */
@Resolver(() => StaffUser)
@RequirePermission('staff:manage')
export class StaffResolver {
  constructor(
    private readonly queries: StaffQueriesService,
    private readonly creator: CreateStaffUserService,
    private readonly updater: UpdateStaffUserService,
    private readonly statusSetter: SetStaffStatusService,
    private readonly passwordResetter: ResetStaffPasswordService,
    private readonly deleter: DeleteStaffUserService,
  ) {}

  @Query(() => StaffUserConnection)
  staffUsers(
    // The pipe returns the parsed arguments (defaults applied, search trimmed).
    @Args(new ZodValidationPipe(schemas.staffUsersArgsSchema)) args: inputs.StaffUsersArgs,
  ): Promise<ConnectionValue<StaffUser>> {
    return this.queries.list(args);
  }

  @Mutation(() => StaffUser)
  createStaffUser(
    @Args(
      'input',
      { type: () => inputs.CreateStaffUserInput },
      new ZodValidationPipe(schemas.createStaffUserInputSchema),
    )
    input: schemas.CreateStaffUserInput,
    @CurrentViewer() viewer: Principal,
  ): Promise<StaffUser> {
    return this.creator.execute(input, viewer);
  }

  @Mutation(() => StaffUser)
  updateStaffUser(
    @Args(
      'input',
      { type: () => inputs.UpdateStaffUserInput },
      new ZodValidationPipe(schemas.updateStaffUserInputSchema),
    )
    input: schemas.UpdateStaffUserInput,
    @CurrentViewer() viewer: Principal,
  ): Promise<StaffUser> {
    return this.updater.execute(input, viewer);
  }

  @Mutation(() => StaffUser)
  setStaffUserStatus(
    @Args(
      'input',
      { type: () => inputs.SetStaffUserStatusInput },
      new ZodValidationPipe(schemas.setStaffUserStatusInputSchema),
    )
    input: schemas.SetStaffUserStatusInput,
    @CurrentViewer() viewer: Principal,
  ): Promise<StaffUser> {
    return this.statusSetter.execute(input, viewer);
  }

  @Mutation(() => StaffUser)
  resetStaffPassword(
    @Args(
      'input',
      { type: () => inputs.ResetStaffPasswordInput },
      new ZodValidationPipe(schemas.resetStaffPasswordInputSchema),
    )
    input: schemas.ResetStaffPasswordInput,
    @CurrentViewer() viewer: Principal,
  ): Promise<StaffUser> {
    return this.passwordResetter.execute(input, viewer);
  }

  @Mutation(() => Boolean, { description: 'Only with no work on record (HAS_HISTORY, D-28).' })
  deleteStaffUser(
    @Args('id', { type: () => ID }, new ZodValidationPipe(schemas.idSchema)) id: string,
    @CurrentViewer() viewer: Principal,
  ): Promise<boolean> {
    return this.deleter.execute(id, viewer);
  }
}
