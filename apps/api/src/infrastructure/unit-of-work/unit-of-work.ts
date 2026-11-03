import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

import { withTransactionRetry } from '../prisma/transaction-retry';
import { TransactionalClient } from '../prisma/transactional-client';

import { AfterCommit } from './after-commit';

/**
 * The single way application services write (ADR-029, INSTRUCTIONS.md §10):
 * one PostgreSQL transaction with local lock/statement timeouts (DATABASE.md §6), whole-transaction
 * retry on serialization failure or deadlock, and after-commit work (outbox publication, cache
 * invalidation) run only once the commit succeeded.
 */
@Injectable()
export class UnitOfWork {
  constructor(
    private readonly db: TransactionalClient,
    private readonly cls: ClsService,
    private readonly afterCommit: AfterCommit,
  ) {}

  run<T>(work: () => Promise<T>): Promise<T> {
    if (this.cls.isActive() && this.db.inTransaction) {
      // Nested call: join the outer transaction; the outer run flushes after its commit.
      return work();
    }
    const execute = async (): Promise<T> => {
      const result = await withTransactionRetry(() => {
        this.afterCommit.reset();
        return this.db.withTransaction(async () => {
          await this.db.client.$queryRaw`SELECT set_config('lock_timeout', '3s', true),
                                                set_config('statement_timeout', '10s', true)`;
          return work();
        });
      });
      await this.afterCommit.flush();
      return result;
    };
    return this.cls.isActive() ? execute() : this.cls.run(execute);
  }
}
