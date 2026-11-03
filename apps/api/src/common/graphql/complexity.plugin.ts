import { getNamedType, GraphQLError, isLeafType } from 'graphql';
import { getComplexity, simpleEstimator, type ComplexityEstimator } from 'graphql-query-complexity';

// @nestjs/apollo is ESM, so its plugin type comes from Apollo's ESM declarations; match them.
import type { ApolloServerPlugin } from '@apollo/server' with { 'resolution-mode': 'import' };

/**
 * Connection fields cost `1 + first × child cost` (API.md §1), so asking for many large pages, or
 * pages nested in pages, is expensive.
 */
export const connectionEstimator: ComplexityEstimator = ({ args, childComplexity }) => {
  const first: unknown = args['first'];
  return typeof first === 'number' ? 1 + first * childComplexity : undefined;
};

/**
 * Scalar and enum fields (including `__typename`) are free: they are columns of a row already
 * fetched. Object fields cost 1 plus their children. A page of 50 full product rows costs about 101.
 */
export const leafEstimator: ComplexityEstimator = ({ field, childComplexity }) =>
  isLeafType(getNamedType(field.type)) ? 0 : 1 + childComplexity;

/** The estimators in order: the first that returns a number decides a field's cost. */
export const COMPLEXITY_ESTIMATORS: readonly ComplexityEstimator[] = [
  connectionEstimator,
  leafEstimator,
  simpleEstimator({ defaultComplexity: 1 }),
];

/**
 * `getComplexity` coerces the variables before Apollo does, so a request with invalid variables
 * (a null for a required field, an unknown enum value) fails here first. That is the caller's
 * mistake, not a server fault: report it as BAD_USER_INPUT with graphql-js's coercion message.
 */
function measure(compute: () => number): number {
  try {
    return compute();
  } catch (error) {
    const message = error instanceof GraphQLError ? error.message : 'The variables are invalid.';
    throw new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } });
  }
}

/** Rejects operations whose estimated complexity exceeds `maximum` (DECISIONS.md ADR-031). */
export function complexityPlugin(maximum: number): ApolloServerPlugin {
  return {
    requestDidStart() {
      return Promise.resolve({
        didResolveOperation({ request, document, schema }) {
          const complexity = measure(() =>
            getComplexity({
              schema,
              query: document,
              variables: request.variables ?? {},
              ...(request.operationName === undefined
                ? {}
                : { operationName: request.operationName }),
              estimators: [...COMPLEXITY_ESTIMATORS],
            }),
          );
          if (complexity > maximum) {
            throw new GraphQLError(
              `Query complexity ${String(complexity)} exceeds the limit of ${String(maximum)}.`,
              { extensions: { code: 'BAD_USER_INPUT' } },
            );
          }
          return Promise.resolve();
        },
      });
    },
  };
}
