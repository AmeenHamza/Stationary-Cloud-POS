import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';

import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import { MetricsService } from '../../infrastructure/metrics/metrics.service';
import { formatGraphQLError } from '../errors/graphql-error.formatter';

import { complexityPlugin } from './complexity.plugin';
import { depthLimitRule } from './depth-limit.rule';
import { errorReportingPlugin } from './error-reporting.plugin';
import { buildContext } from './graphql-context';
import { metricsPlugin } from './metrics.plugin';
import { asWsContext, WS_LIFECYCLE, type WsLifecycle } from './ws-lifecycle';

/** Limits from DECISIONS.md ADR-031 / API.md §1. */
export const MAX_QUERY_DEPTH = 10;
export const MAX_QUERY_COMPLEXITY = 1_000;

/**
 * Code-first GraphQL (ADR-004): queries and mutations over HTTP, the `shopEvents` subscription over
 * `graphql-ws` on the same path with the realtime module's connection hooks. CSRF prevention is on,
 * introspection is off in production, stack traces are never sent, errors follow API.md §4.
 */
@Module({
  imports: [
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      inject: [APP_CONFIG, WS_LIFECYCLE, MetricsService],
      useFactory: (
        config: AppConfig,
        ws: WsLifecycle,
        metrics: MetricsService,
      ): ApolloDriverConfig => ({
        path: '/graphql',
        autoSchemaFile: true,
        sortSchema: true,
        graphiql: false,
        introspection: config.NODE_ENV !== 'production',
        csrfPrevention: true,
        includeStacktraceInErrorResponses: false,
        formatError: formatGraphQLError,
        validationRules: [depthLimitRule(MAX_QUERY_DEPTH)],
        plugins: [
          errorReportingPlugin(),
          complexityPlugin(MAX_QUERY_COMPLEXITY),
          metricsPlugin(metrics),
        ],
        context: buildContext,
        subscriptions: {
          'graphql-ws': {
            path: '/graphql',
            onConnect: (ctx) => ws.onConnect(asWsContext(ctx)),
            onSubscribe: (ctx, id, payload) => ws.onSubscribe(asWsContext(ctx), id, payload),
            onDisconnect: (ctx) => {
              ws.onDisconnect(asWsContext(ctx));
            },
          },
        },
      }),
    }),
  ],
})
export class GraphqlApiModule {}
