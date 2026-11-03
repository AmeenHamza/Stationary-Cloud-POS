import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { hasPermission } from '@pos/contracts';

import { AppError } from '../errors/app-error';

import { ACCESS_POLICY, type AccessPolicy } from './access-policy';
import { PRINCIPAL_RESOLVER, attachPrincipal, type PrincipalResolver } from './principal';
import { requestOf } from './request-of';

/**
 * Global guard (SYSTEM_DESIGN.md §2.4): reads the handler's access policy, resolves the session
 * for non-public handlers and checks the role's permission. A handler without a policy is refused.
 */
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(PRINCIPAL_RESOLVER) private readonly resolver: PrincipalResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policy = this.reflector.getAllAndOverride<AccessPolicy | undefined>(ACCESS_POLICY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (policy === undefined) {
      throw new AppError('FORBIDDEN', 'This operation is not available.');
    }
    if (policy.kind === 'public') {
      return true;
    }
    const request = requestOf(context);
    const principal = await this.resolver.resolve(request);
    if (principal === null) {
      throw new AppError('UNAUTHENTICATED', 'Please sign in again.');
    }
    if (policy.kind === 'permission' && !hasPermission(principal.role, policy.permission)) {
      throw new AppError('FORBIDDEN', 'You do not have permission to do this.');
    }
    attachPrincipal(request, principal);
    return true;
  }
}
