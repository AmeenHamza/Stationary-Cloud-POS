import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

/**
 * Prometheus metrics (INSTRUCTIONS.md §12): names `pos_<area>_<metric>_<unit>`; labels never carry
 * ids or personal data. Values are read on scrape; nothing runs on a timer.
 */
@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly cacheRequests = new Counter({
    name: 'pos_cache_requests_total',
    help: 'Reference-cache lookups by family and result (hit, miss, bypass).',
    labelNames: ['family', 'result'] as const,
    registers: [this.registry],
  });

  readonly redisUp = new Gauge({
    name: 'pos_redis_up',
    help: '1 when the Redis client of this role is ready.',
    labelNames: ['role'] as const,
    registers: [this.registry],
  });

  readonly redisErrors = new Counter({
    name: 'pos_redis_errors_total',
    help: 'Redis command or connection errors by client role.',
    labelNames: ['role'] as const,
    registers: [this.registry],
  });

  readonly outboxPublishFailures = new Counter({
    name: 'pos_outbox_publish_failures_total',
    help: 'Failed attempts to publish outbox events to Redis.',
    registers: [this.registry],
  });

  readonly outboxUnpublished = new Gauge({
    name: 'pos_outbox_unpublished',
    help: 'Outbox events not yet published (updated after each drain).',
    registers: [this.registry],
  });

  readonly rateLimitRejections = new Counter({
    name: 'pos_rate_limit_rejections_total',
    help: 'Requests rejected by a rate-limit bucket.',
    labelNames: ['bucket'] as const,
    registers: [this.registry],
  });

  readonly rateLimitDegraded = new Counter({
    name: 'pos_rate_limit_degraded_total',
    help: 'Rate-limit checks decided by the Redis-down policy (memory, open, closed).',
    labelNames: ['bucket', 'policy'] as const,
    registers: [this.registry],
  });

  /** DEPLOYMENT.md §8 alert: `CreateSale` p95 above 1.5 s for 10 minutes. */
  readonly graphqlDuration = new Histogram({
    name: 'pos_graphql_duration_seconds',
    help: 'GraphQL HTTP operations by operation name and outcome (ok, error).',
    labelNames: ['operation', 'outcome'] as const,
    buckets: [0.025, 0.05, 0.1, 0.25, 0.5, 1, 1.5, 2.5, 5, 10],
    registers: [this.registry],
  });

  readonly wsConnections = new Gauge({
    name: 'pos_ws_connections',
    help: 'Open, authenticated live-channel connections on this instance.',
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry, prefix: 'pos_' });
  }
}
