import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import { AppError } from '../errors/app-error';

import { principalOf, type Principal } from './principal';
import { requestOf } from './request-of';

/** The signed-in user, set by `AccessGuard`. Only valid on authenticated handlers. */
export const CurrentViewer = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Principal => {
    const principal = principalOf(requestOf(context));
    if (principal === undefined) {
      throw new AppError('UNAUTHENTICATED', 'Please sign in again.');
    }
    return principal;
  },
);
