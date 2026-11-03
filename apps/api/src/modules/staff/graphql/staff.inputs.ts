import { ArgsType, Field, ID, InputType, Int } from '@nestjs/graphql';

import { UserRoleEnum, UserStatusEnum } from '../../../common/graphql/enums.registry';
import { PageArgs } from '../../../common/pagination/page.args';

import type { UserRole, UserStatus } from '@pos/contracts';

/** Shapes only; validation is in `@pos/validation` (staff.schemas.ts). */
@InputType()
export class StaffUsersFilter {
  @Field(() => String, { nullable: true })
  search?: string | null;

  @Field(() => UserStatusEnum, { nullable: true })
  status?: UserStatus | null;
}

@ArgsType()
export class StaffUsersArgs extends PageArgs {
  @Field(() => StaffUsersFilter, { nullable: true })
  filter?: StaffUsersFilter | null;
}

@InputType()
export class CreateStaffUserInput {
  @Field(() => String)
  username!: string;

  @Field(() => String)
  fullName!: string;

  @Field(() => UserRoleEnum)
  role!: UserRole;

  @Field(() => String)
  password!: string;
}

@InputType()
export class UpdateStaffUserInput {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  fullName!: string;

  @Field(() => UserRoleEnum)
  role!: UserRole;

  @Field(() => Int)
  version!: number;
}

@InputType()
export class SetStaffUserStatusInput {
  @Field(() => ID)
  id!: string;

  @Field(() => UserStatusEnum)
  status!: UserStatus;
}

@InputType()
export class ResetStaffPasswordInput {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  newPassword!: string;
}
