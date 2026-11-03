import { Global, Module } from '@nestjs/common';

import { PRINCIPAL_RESOLVER } from '../../common/auth/principal';
import { AuditModule } from '../audit';

import { ChangePasswordService } from './application/change-password.service';
import { LoginService } from './application/login.service';
import { LogoutService } from './application/logout.service';
import { PasswordHasher } from './application/password-hasher';
import { SessionRevocationService } from './application/session-revocation.service';
import { SessionService } from './application/session.service';
import { ViewerService } from './application/viewer.service';
import { AuthResolver } from './graphql/auth.resolver';
import { AuthUsersRepository } from './persistence/auth-users.repository';
import { SessionsRepository } from './persistence/sessions.repository';

/**
 * Login, sessions and revocation (F-01, F-03). Global because it provides PRINCIPAL_RESOLVER to the
 * app-wide `AccessGuard`; other modules use the public API in `index.ts`.
 */
@Global()
@Module({
  imports: [AuditModule],
  providers: [
    AuthResolver,
    LoginService,
    LogoutService,
    ChangePasswordService,
    ViewerService,
    SessionService,
    SessionRevocationService,
    PasswordHasher,
    AuthUsersRepository,
    SessionsRepository,
    { provide: PRINCIPAL_RESOLVER, useExisting: SessionService },
  ],
  exports: [PRINCIPAL_RESOLVER, SessionRevocationService, PasswordHasher],
})
export class AuthModule {}
