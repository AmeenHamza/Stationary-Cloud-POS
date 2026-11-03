import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';

import {
  changePasswordInputSchema,
  loginInputSchema,
  type ChangePasswordInput,
  type LoginInput,
} from '@pos/validation';

import { Authenticated, Public } from '../../../common/auth/access-policy';
import { CurrentViewer } from '../../../common/auth/current-viewer.decorator';
import { ClockService } from '../../../common/time/clock.service';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { ChangePasswordService } from '../application/change-password.service';
import { LoginService } from '../application/login.service';
import { LogoutService } from '../application/logout.service';
import { ViewerService } from '../application/viewer.service';
import { clearSessionCookie, setSessionCookie } from '../session-cookie';

import {
  ChangePasswordInput as ChangePasswordInputType,
  LoginInput as LoginInputType,
} from './auth.inputs';
import { Viewer } from './viewer.type';

import type { Principal } from '../../../common/auth/principal';
import type { HttpGraphqlContext } from '../../../common/graphql/graphql-context';

/** `login`, `logout`, `me`, `changePassword` (API.md §6, F-01, F-03). */
@Resolver()
export class AuthResolver {
  constructor(
    private readonly loginService: LoginService,
    private readonly logoutService: LogoutService,
    private readonly changePasswordService: ChangePasswordService,
    private readonly viewers: ViewerService,
    private readonly clock: ClockService,
  ) {}

  @Mutation(() => Viewer)
  @Public()
  async login(
    @Args('input', { type: () => LoginInputType }, new ZodValidationPipe(loginInputSchema))
    input: LoginInput,
    @Context() context: HttpGraphqlContext,
  ): Promise<Viewer> {
    const result = await this.loginService.execute(input);
    setSessionCookie(context.res, result.token, result.expiresAt, this.clock.now());
    return this.viewers.load(result.userId);
  }

  @Mutation(() => Boolean)
  @Authenticated()
  async logout(
    @CurrentViewer() viewer: Principal,
    @Context() context: HttpGraphqlContext,
  ): Promise<boolean> {
    await this.logoutService.execute(viewer);
    clearSessionCookie(context.res);
    return true;
  }

  @Query(() => Viewer)
  @Authenticated()
  me(@CurrentViewer() viewer: Principal): Promise<Viewer> {
    return this.viewers.load(viewer.userId);
  }

  @Mutation(() => Boolean)
  @Authenticated()
  async changePassword(
    @Args(
      'input',
      { type: () => ChangePasswordInputType },
      new ZodValidationPipe(changePasswordInputSchema),
    )
    input: ChangePasswordInput,
    @CurrentViewer() viewer: Principal,
  ): Promise<boolean> {
    await this.changePasswordService.execute(input, viewer);
    return true;
  }
}
