import { Field, InputType } from '@nestjs/graphql';

/** Shapes only; validation is `loginInputSchema` / `changePasswordInputSchema` (@pos/validation). */
@InputType()
export class LoginInput {
  @Field(() => String)
  username!: string;

  @Field(() => String)
  password!: string;
}

@InputType()
export class ChangePasswordInput {
  @Field(() => String)
  currentPassword!: string;

  @Field(() => String)
  newPassword!: string;
}
