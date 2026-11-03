import { createHash, timingSafeEqual } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { signUpInputSchema, type SignUpInput } from '@pos/validation';

import { AppError } from '../../../common/errors/app-error';
import { RequestContext } from '../../../common/http/request-context';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { APP_CONFIG, type AppConfig } from '../../../config/app-config';
import { RateLimiterService } from '../../../infrastructure/rate-limit/rate-limiter.service';

import { CreateStaffUserService } from './create-staff-user.service';

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

@Injectable()
export class SignUpService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly limiter: RateLimiterService,
    private readonly request: RequestContext,
    private readonly creator: CreateStaffUserService,
  ) {}

  async execute(input: SignUpInput): Promise<void> {
    await this.limiter.consume('signup-global', 'all');
    await this.limiter.consume('signup-ip', this.request.client().ip ?? 'unknown');

    const configured = this.config.SIGNUP_SECRET ?? '';
    const matches = timingSafeEqual(digest(input.signupSecret), digest(configured));
    if (!matches || configured.length === 0) {
      throw new AppError('UNAUTHENTICATED', 'Invalid signup secret.');
    }

    const { username, fullName, password, role } = new ZodValidationPipe(
      signUpInputSchema,
    ).transform(input);
    await this.creator.execute({ username, fullName, password, role }, null);
  }
}
