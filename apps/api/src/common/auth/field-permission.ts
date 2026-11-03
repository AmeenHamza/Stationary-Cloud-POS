import { hasPermission, type Permission } from '@pos/contracts';

import { AppError } from '../errors/app-error';

import { principalOf } from './principal';

import type { GraphqlContext } from '../graphql/graphql-context';
import type { FieldMiddleware } from '@nestjs/graphql';

/**
 * Field-level authorization (SYSTEM_DESIGN.md §2.4, SEC-03): the field resolves only for roles with
 * `permission`; anyone else gets FORBIDDEN for that field (null value plus an error), while the rest
 * of the object is returned normally.
 */
export function requireFieldPermission(permission: Permission): FieldMiddleware {
  return async (ctx, next) => {
    const principal = principalOf((ctx.context as GraphqlContext).req);
    if (principal === undefined || !hasPermission(principal.role, permission)) {
      throw new AppError('FORBIDDEN', 'You do not have permission to see this field.');
    }
    const value: unknown = await next();
    return value;
  };
}
