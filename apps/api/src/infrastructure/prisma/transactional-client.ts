import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import type { PrismaTx } from './transactional.module';
import type { Prisma } from '@pos/database';

/**
 * The Prisma client of the current transaction (or the base client outside one). Repositories use
 * this instead of `TransactionHost` directly (ADR-029).
 *
 * Why the explicit return type: the CLS Prisma adapter derives its client type from the last
 * `$transaction` overload, which Prisma 7 declares as the array form, so `txHost.tx` is typed
 * `never`. At runtime it is the interactive-transaction client, `Prisma.TransactionClient`.
 */
@Injectable()
export class TransactionalClient {
  constructor(private readonly txHost: TransactionHost<PrismaTx>) {}

  get client(): Prisma.TransactionClient {
    return this.txHost.tx;
  }

  get inTransaction(): boolean {
    return this.txHost.isTransactionActive();
  }

  withTransaction<T>(work: () => Promise<T>): Promise<T> {
    return this.txHost.withTransaction(work);
  }
}
