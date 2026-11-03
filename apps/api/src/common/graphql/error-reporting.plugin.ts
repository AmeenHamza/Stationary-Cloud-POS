import { unwrapResolverError } from '@apollo/server/errors';
import { Logger } from '@nestjs/common';

import { isClientRequestError } from '../errors/graphql-error.formatter';
import { toPublicError } from '../errors/public-error';

import type { GraphqlContext } from './graphql-context';
// @nestjs/apollo is ESM, so its plugin type comes from Apollo's ESM declarations; match them.
import type { ApolloServerPlugin } from '@apollo/server' with { 'resolution-mode': 'import' };

/**
 * Logs unexpected GraphQL errors once, with the request id, and adds that id to every
 * INTERNAL_SERVER_ERROR the client receives (API.md §4).
 */
export function errorReportingPlugin(): ApolloServerPlugin<GraphqlContext> {
  const logger = new Logger('GraphQL');
  return {
    requestDidStart() {
      return Promise.resolve({
        didEncounterErrors({ errors, contextValue, request }) {
          for (const error of errors) {
            const original = unwrapResolverError(error);
            const expected = toPublicError(original) !== null || isClientRequestError(error);
            if (!expected) {
              logger.error(
                {
                  err: original,
                  requestId: contextValue.requestId,
                  operation: request.operationName,
                },
                'Unexpected GraphQL error',
              );
            }
          }
          return Promise.resolve();
        },
        willSendResponse({ response, contextValue }) {
          if (response.body.kind === 'single' && response.body.singleResult.errors !== undefined) {
            response.body.singleResult.errors = response.body.singleResult.errors.map((error) =>
              error.extensions?.['code'] === 'INTERNAL_SERVER_ERROR'
                ? {
                    ...error,
                    extensions: { ...error.extensions, requestId: contextValue.requestId },
                  }
                : error,
            );
          }
          return Promise.resolve();
        },
      });
    },
  };
}
