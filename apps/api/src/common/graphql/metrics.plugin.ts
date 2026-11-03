import { performance } from 'node:perf_hooks';

import { getOperationAST } from 'graphql';

import type { GraphqlContext } from './graphql-context';
import type { MetricsService } from '../../infrastructure/metrics/metrics.service';
// @nestjs/apollo is ESM, so its plugin type comes from Apollo's ESM declarations; match them.
import type { ApolloServerPlugin } from '@apollo/server' with { 'resolution-mode': 'import' };
import type { DocumentNode } from 'graphql';

/** The web app sends about 70 named operations; anything beyond the cap is counted as `other`. */
const MAX_OPERATION_LABELS = 200;
const OPERATION_NAME = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

/** The name the client sent, or the one written in the document (some clients send only the query). */
function nameOf(
  sent: string | null | undefined,
  document: DocumentNode | undefined,
): string | undefined {
  return sent ?? (document === undefined ? undefined : getOperationAST(document)?.name?.value);
}

/**
 * Times each GraphQL HTTP request into `pos_graphql_duration_seconds` (DEPLOYMENT.md §8). Labels are
 * operation names only, capped so a client cannot grow the label set; never ids or arguments.
 */
export function metricsPlugin(metrics: MetricsService): ApolloServerPlugin<GraphqlContext> {
  const seen = new Set<string>();
  const label = (name: string | undefined): string => {
    if (name === undefined || !OPERATION_NAME.test(name)) {
      return 'anonymous';
    }
    if (!seen.has(name) && seen.size >= MAX_OPERATION_LABELS) {
      return 'other';
    }
    seen.add(name);
    return name;
  };
  return {
    requestDidStart() {
      const started = performance.now();
      return Promise.resolve({
        willSendResponse({ request, response, document }) {
          const failed =
            response.body.kind === 'single' && response.body.singleResult.errors !== undefined;
          metrics.graphqlDuration
            .labels(label(nameOf(request.operationName, document)), failed ? 'error' : 'ok')
            .observe((performance.now() - started) / 1_000);
          return Promise.resolve();
        },
      });
    },
  };
}
