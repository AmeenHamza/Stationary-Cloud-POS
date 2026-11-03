import { Module } from '@nestjs/common';

import { QueueRuntime } from './queue-runtime';

/** BullMQ for product imports only (ADR-020); jobs keep their state in PostgreSQL. */
@Module({
  providers: [QueueRuntime],
  exports: [QueueRuntime],
})
export class QueueModule {}
