import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AccessGuard } from './auth/access.guard';
import { RequestContext } from './http/request-context';
import { FailpointService } from './testing/failpoint.service';
import { ClockService } from './time/clock.service';

/**
 * Framework-level services shared by every module (no business rules), plus the global
 * `AccessGuard`. The guard's PRINCIPAL_RESOLVER is provided by the auth module.
 */
@Global()
@Module({
  providers: [
    ClockService,
    FailpointService,
    RequestContext,
    { provide: APP_GUARD, useClass: AccessGuard },
  ],
  exports: [ClockService, FailpointService, RequestContext],
})
export class CommonModule {}
