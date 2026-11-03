import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { Queue, Worker, type Job } from 'bullmq';

import { sleep } from '../../common/time/sleep';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import { RedisStatus } from '../redis/redis-status';

import { queueConnection } from './queue-connection';
import { QUEUE_PREFIX } from './queue-names';

export type JobHandler = (data: Readonly<Record<string, unknown>>) => Promise<void>;

/** Settings from SYSTEM_DESIGN.md §6.8. */
const JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: { age: 7 * 24 * 3_600, count: 100 },
  removeOnFail: { age: 30 * 24 * 3_600 },
};
const SHUTDOWN_WAIT_MS = 5_000;

/**
 * BullMQ inside the API process (ADR-020), started only once Redis is ready: the API boots, serves
 * and shuts down with Redis unreachable (BullMQ would otherwise wait forever to connect and to
 * close). Consumers register a handler per queue name; work is one job at a time with a 60 s lock.
 */
@Injectable()
export class QueueRuntime implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(QueueRuntime.name);
  private readonly handlers = new Map<string, JobHandler>();
  private readonly queues = new Map<string, Queue>();
  private readonly workers: Worker[] = [];

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly status: RedisStatus,
  ) {
    status.onReady('publisher', () => {
      this.start();
    });
  }

  /** Register before the application bootstraps (in a consumer's constructor). */
  register(name: string, handler: JobHandler): void {
    this.handlers.set(name, handler);
  }

  onApplicationBootstrap(): void {
    if (this.status.isReady('publisher')) this.start();
  }

  /** True when the queue exists and Redis is up, so `add` is worth trying. */
  canAccept(name: string): boolean {
    return this.queues.has(name) && this.status.isReady('publisher');
  }

  async add(name: string, data: Readonly<Record<string, unknown>>, jobId: string): Promise<void> {
    const queue = this.queues.get(name);
    if (queue === undefined) throw new Error(`Queue ${name} is not running`);
    await queue.add(name, data, { jobId });
  }

  async onApplicationShutdown(): Promise<void> {
    const closing = [...this.workers, ...this.queues.values()].map((item) => item.close());
    await Promise.race([Promise.allSettled(closing), sleep(SHUTDOWN_WAIT_MS)]);
  }

  private start(): void {
    if (this.queues.size > 0) return;
    const connection = queueConnection(this.config.REDIS_URL);
    for (const [name, handler] of this.handlers) {
      const queue = new Queue(name, {
        connection,
        prefix: QUEUE_PREFIX,
        defaultJobOptions: JOB_OPTIONS,
      });
      const worker = new Worker(name, (job: Job<Record<string, unknown>>) => handler(job.data), {
        connection,
        prefix: QUEUE_PREFIX,
        concurrency: 1,
        lockDuration: 60_000,
      });
      const warn = (error: Error): void => {
        this.logger.warn({ queue: name, reason: error.message }, 'Queue connection problem');
      };
      queue.on('error', warn);
      worker.on('error', warn);
      this.queues.set(name, queue);
      this.workers.push(worker);
    }
  }
}
