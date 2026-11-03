import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import { RequestContext } from '../../../common/http/request-context';
import { RateLimiterService } from '../../../infrastructure/rate-limit/rate-limiter.service';
import { UnitOfWork } from '../../../infrastructure/unit-of-work/unit-of-work';
import { AuditService } from '../../audit';
import { AuthUsersRepository } from '../persistence/auth-users.repository';

import { PasswordHasher } from './password-hasher';
import { SessionService } from './session.service';

import type { LoginInput } from '@pos/validation';

export interface LoginResult {
  userId: string;
  token: string;
  expiresAt: Date;
}

const INVALID = 'Invalid username or password.';

/**
 * `login` (F-01, SYSTEM_DESIGN.md §2.1). One generic error for every failure, constant work for
 * unknown usernames, rate limits per username+IP and per IP, and an audit row either way.
 */
@Injectable()
export class LoginService {
  constructor(
    private readonly users: AuthUsersRepository,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionService,
    private readonly limiter: RateLimiterService,
    private readonly audit: AuditService,
    private readonly uow: UnitOfWork,
    private readonly request: RequestContext,
  ) {}

  async execute(input: LoginInput): Promise<LoginResult> {
    const client = this.request.client();
    const ip = client.ip ?? 'unknown';
    await this.limiter.consume('login-ip', ip);
    await this.limiter.consume('login', `${input.username}|${ip}`);

    const user = await this.users.findForLogin(input.username);
    const valid =
      user === null
        ? await this.hasher.verifyUnknownUser(input.password)
        : await this.hasher.verify(user.passwordHash, input.password);

    if (user === null || !valid || user.status !== 'ACTIVE') {
      await this.uow.run(() =>
        this.audit.record('auth.loginFailed', null, {
          // The typed username is not stored: it may be a mistyped password.
          ...(user === null ? {} : { entityType: 'user', entityId: user.id }),
          metadata: {
            reason: user === null ? 'UNKNOWN_USER' : valid ? 'DISABLED' : 'BAD_PASSWORD',
          },
        }),
      );
      throw new AppError('UNAUTHENTICATED', INVALID);
    }

    return this.uow.run(async () => {
      const session = await this.sessions.create(user.id, client);
      await this.audit.record('auth.loginSucceeded', user.id, {
        entityType: 'user',
        entityId: user.id,
      });
      return { userId: user.id, ...session };
    });
  }
}
