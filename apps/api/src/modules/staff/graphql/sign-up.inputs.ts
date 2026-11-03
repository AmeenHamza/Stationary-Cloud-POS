import { Field, InputType } from '@nestjs/graphql';

import { CreateStaffUserInput } from './staff.inputs';

@InputType()
export class SignUpInput extends CreateStaffUserInput {
  @Field(() => String)
  signupSecret!: string;
}
