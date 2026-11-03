import { GqlExecutionContext } from '@nestjs/graphql';

import type { SessionRequest } from './principal';
import type { GraphqlContext } from '../graphql/graphql-context';
import type { ExecutionContext } from '@nestjs/common';

/** The HTTP request behind a GraphQL operation or a REST call. */
export function requestOf(context: ExecutionContext): SessionRequest {
  if (context.getType<string>() === 'graphql') {
    return GqlExecutionContext.create(context).getContext<GraphqlContext>().req;
  }
  return context.switchToHttp().getRequest<SessionRequest>();
}
