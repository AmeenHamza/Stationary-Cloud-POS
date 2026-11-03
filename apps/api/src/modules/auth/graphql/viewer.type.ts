import { Field, ID, ObjectType } from '@nestjs/graphql';

import { UserRoleEnum } from '../../../common/graphql/enums.registry';

import type { Permission, UserRole } from '@pos/contracts';

/** The signed-in user (API.md §6.1 `me`). `permissions` drives the web's `useCan()` (UI hint only). */
@ObjectType('Viewer')
export class Viewer {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  username!: string;

  @Field(() => String)
  fullName!: string;

  @Field(() => UserRoleEnum)
  role!: UserRole;

  @Field(() => [String])
  permissions!: Permission[];
}
