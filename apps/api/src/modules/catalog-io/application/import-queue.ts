import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';

import { sleep } from '../../../common/time/sleep';
import { PRODUCT_IMPORT_QUEUE } from '../../../infrastructure/queue/queue-names';
import { QueueRuntime } from '../../../infrastructure/queue/queue-runtime';
import { RedisStatus } from '../../../infrastructure/redis/redis-status';
import { ImportJobsRepository } from '../persistence/import-jobs.repository';

import { ImportRunner } from './import-runner.service';

/** How long an upload waits for Redis to accept the job before leaving it to the drain. */
const ENQUEUE_TIMEOUT_MS = 2_000;

/**
 * Puts staged jobs on the `product-import` queue (SYSTEM_DESIGN.md §6.8) and runs them there. The
 * BullMQ job id is the import job id, so enqueueing twice is harmless. An upload never waits on a
 * Redis outage: the job stays `QUEUED` in PostgreSQL and the drain enqueues it at startup and
 * whenever Redis is ready again (RED-08). BullMQ retries a failed run; the runner resumes at the
 * first `PENDING` row.
 */
@Injectable()
export class ImportQueue implements OnApplicationBootstrap {
  private readonly logger = new Logger(ImportQueue.name);

  constructor(
    private readonly runtime: QueueRuntime,
    private readonly jobs: ImportJobsRepository,
    runner: ImportRunner,
    status: RedisStatus,
  ) {
    runtime.register(PRODUCT_IMPORT_QUEUE, (data) => runner.run(String(data['importJobId'])));
    status.onReady('publisher', () => this.drain());
  }

  onApplicationBootstrap(): void {
    void this.drain();
  }

  /** True when Redis accepted the job; false leaves it for the drain. */
  async enqueue(importJobId: string): Promise<boolean> {
    if (!this.runtime.canAccept(PRODUCT_IMPORT_QUEUE)) {
      return false;
    }
    const added = this.runtime
      .add(PRODUCT_IMPORT_QUEUE, { importJobId }, importJobId)
      .then(() => true)
      .catch((error: unknown) => {
        this.logger.warn(
          { importJobId, reason: String(error) },
          'Import left queued for the drain',
        );
        return false;
      });
    return Promise.race([added, sleep(ENQUEUE_TIMEOUT_MS).then(() => false)]);
  }

  /** Enqueues every job not yet finished (the queue de-duplicates by job id). */
  async drain(): Promise<void> {
    if (!this.runtime.canAccept(PRODUCT_IMPORT_QUEUE)) {
      return;
    }
    try {
      for (const job of await this.jobs.queuedIds()) {
        await this.enqueue(job.id);
      }
    } catch (error) {
      this.logger.warn({ reason: String(error) }, 'Import drain deferred');
    }
  }
}
