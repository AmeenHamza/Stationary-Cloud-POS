import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';

import { ClockService } from '../../common/time/clock.service';
import { MetricsService } from '../metrics/metrics.service';
import { RedisStatus } from '../redis/redis-status';

import { channelFor, isAudience } from './channels';
import { encodeEnvelope } from './event-envelope';
import { OutboxRepository, type OutboxRow } from './outbox.repository';
import { RedisPubSub } from './redis-pubsub';

import type { EventType } from '@pos/contracts';

const DRAIN_BATCH = 100;

/**
 * Publishes committed outbox rows to Redis (SYSTEM_DESIGN.md §5.2). Fast path right after commit;
 * unpublished rows are drained on startup, on the publisher's Redis `ready` event and after the
 * next successful publish following a failure. There is no polling loop.
 */
@Injectable()
export class OutboxPublisher implements OnApplicationBootstrap {
  private readonly logger = new Logger(OutboxPublisher.name);
  private drainNeeded = false;
  private draining: Promise<void> | null = null;

  constructor(
    private readonly repository: OutboxRepository,
    private readonly pubsub: RedisPubSub,
    private readonly status: RedisStatus,
    private readonly metrics: MetricsService,
    private readonly clock: ClockService,
  ) {
    status.onReady('publisher', () => this.drain());
  }

  onApplicationBootstrap(): void {
    if (this.status.isReady('publisher')) {
      void this.drain();
    }
  }

  async publish(seqs: readonly bigint[]): Promise<void> {
    try {
      const rows = await this.repository.findUnpublished(seqs);
      await this.send(rows);
      await this.repository.markPublished(
        rows.map((r) => r.seq),
        this.clock.now(),
      );
      if (this.drainNeeded) {
        void this.drain();
      }
    } catch (error) {
      this.drainNeeded = true;
      this.metrics.outboxPublishFailures.inc();
      this.logger.warn({ reason: String(error) }, 'Outbox publish deferred until Redis is ready');
    }
  }

  /** Publishes every unpublished row in locked batches; concurrent calls share one run. */
  drain(): Promise<void> {
    this.draining ??= this.drainAll().finally(() => {
      this.draining = null;
    });
    return this.draining;
  }

  private async drainAll(): Promise<void> {
    this.drainNeeded = false;
    try {
      let published = DRAIN_BATCH;
      while (published === DRAIN_BATCH) {
        published = await this.repository.runInTransaction(async (client) => {
          const rows = await this.repository.claimBatch(client, DRAIN_BATCH);
          await this.send(rows);
          await this.repository.markPublished(
            rows.map((r) => r.seq),
            this.clock.now(),
            client,
          );
          return rows.length;
        });
      }
      this.metrics.outboxUnpublished.set(await this.repository.countUnpublished());
    } catch (error) {
      this.drainNeeded = true;
      this.metrics.outboxPublishFailures.inc();
      this.logger.warn({ reason: String(error) }, 'Outbox drain interrupted');
    }
  }

  private async send(rows: readonly OutboxRow[]): Promise<void> {
    for (const row of rows) {
      if (!isAudience(row.audience)) {
        this.logger.error({ seq: String(row.seq) }, 'Outbox row with invalid audience skipped');
        continue;
      }
      await this.pubsub.publish(
        channelFor(row.audience),
        encodeEnvelope({
          seq: String(row.seq),
          type: row.type as EventType,
          schemaVersion: row.schemaVersion,
          occurredAt: row.createdAt.toISOString(),
          payload: row.payload as Record<string, unknown>,
        }),
      );
    }
  }
}
