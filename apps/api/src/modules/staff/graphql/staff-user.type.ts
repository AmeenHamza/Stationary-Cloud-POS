import { Field, GraphQLISODateTime, ID, Int, ObjectType } from '@nestjs/graphql';

import { UserRoleEnum, UserStatusEnum } from '../../../common/graphql/enums.registry';
import { Connection } from '../../../common/pagination/connection.factory';

import type { UserRole, UserStatus } from '@pos/contracts';

/** A staff account as the admin's Staff screen shows it (F-31). Never includes the password hash. */
@ObjectType('StaffUser')
export class StaffUser {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  username!: string;

  @Field(() => String)
  fullName!: string;

  @Field(() => UserRoleEnum)
  role!: UserRole;

  @Field(() => UserStatusEnum)
  status!: UserStatus;

  @Field(() => Int, { description: 'Optimistic-lock version; send it back with updateStaffUser.' })
  version!: number;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;
}

@ObjectType('StaffUserConnection')
export class StaffUserConnection extends Connection(StaffUser) {}
