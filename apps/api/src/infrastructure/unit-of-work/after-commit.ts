import { Injectable, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

interface Collector {
  items: unknown[];
  handler: (items: unknown[]) => Promise<void>;
}

const STORE_KEY = 'pos.afterCommit';

/**
 * Work that must happen only after a transaction commits (ADR-009): outbox publication and cache
 * invalidation. Items are collected per named collector inside the transaction and handed to its
 * handler once, after commit. A retried attempt starts with an empty store.
 */
@Injectable()
export class AfterCommit {
  private readonly logger = new Logger(AfterCommit.name);

  constructor(private readonly cls: ClsService) {}

  collect<T>(name: string, item: T, handler: (items: T[]) => Promise<void>): void {
    const store = this.store();
    let collector = store.get(name);
    if (collector === undefined) {
      collector = { items: [], handler: handler as (items: unknown[]) => Promise<void> };
      store.set(name, collector);
    }
    collector.items.push(item);
  }

  reset(): void {
    this.cls.set(STORE_KEY, new Map<string, Collector>());
  }

  /** Runs every collector's handler. Failures are logged, never thrown: the commit already happened. */
  async flush(): Promise<void> {
    const store = this.store();
    this.reset();
    for (const [name, collector] of store) {
      try {
        await collector.handler(collector.items);
      } catch (error) {
        this.logger.warn({ err: error, collector: name }, 'After-commit task failed');
      }
    }
  }

  private store(): Map<string, Collector> {
    const existing = this.cls.get<Map<string, Collector> | undefined>(STORE_KEY);
    if (existing !== undefined) {
      return existing;
    }
    const created = new Map<string, Collector>();
    this.cls.set(STORE_KEY, created);
    return created;
  }
}
