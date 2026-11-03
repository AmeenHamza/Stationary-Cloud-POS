import { unwrapResolverError } from '@apollo/server/errors';

import { toPublicError } from './public-error';

import type { GraphQLFormattedError } from 'graphql';

/** Apollo codes that mean "the request itself was wrong" — reported to clients as BAD_USER_INPUT. */
const CLIENT_ERROR_CODES = new Set([
  'GRAPHQL_PARSE_FAILED',
  'GRAPHQL_VALIDATION_FAILED',
  'BAD_USER_INPUT',
  'BAD_REQUEST',
  'OPERATION_RESOLUTION_FAILURE',
  'PERSISTED_QUERY_NOT_FOUND',
  'PERSISTED_QUERY_NOT_SUPPORTED',
]);

export const INTERNAL_MESSAGE = 'Something went wrong.';

export function isClientRequestError(error: {
  readonly extensions?: Readonly<Record<string, unknown>> | undefined;
}): boolean {
  const code = error.extensions?.['code'];
  return typeof code === 'string' && CLIENT_ERROR_CODES.has(code);
}

/**
 * Apollo `formatError` (API.md §4): known errors keep their code and safe details; request errors
 * become BAD_USER_INPUT; everything else is masked as INTERNAL_SERVER_ERROR. Stack traces,
 * SQL and Prisma messages never reach the client.
 */
export function formatGraphQLError(
  formatted: GraphQLFormattedError,
  error: unknown,
): GraphQLFormattedError {
  const location = {
    ...(formatted.locations === undefined ? {} : { locations: formatted.locations }),
    ...(formatted.path === undefined ? {} : { path: formatted.path }),
  };
  const known = toPublicError(unwrapResolverError(error));
  if (known !== null) {
    return {
      message: known.message,
      ...location,
      extensions: { code: known.code, ...known.details },
    };
  }
  if (isClientRequestError(formatted)) {
    return { message: formatted.message, ...location, extensions: { code: 'BAD_USER_INPUT' } };
  }
  return { message: INTERNAL_MESSAGE, ...location, extensions: { code: 'INTERNAL_SERVER_ERROR' } };
}
