import { Args, Mutation, Resolver } from '@nestjs/graphql';

import { Public } from '../../../common/auth/access-policy';
import { SignUpService } from '../application/sign-up.service';

import { SignUpInput } from './sign-up.inputs';

@Resolver()
export class SignUpResolver {
  constructor(private readonly signUpService: SignUpService) {}

  @Mutation(() => Boolean)
  @Public()
  async signUp(@Args('input', { type: () => SignUpInput }) input: SignUpInput): Promise<boolean> {
    await this.signUpService.execute(input);
    return true;
  }
}
