import { Global, Module } from '@nestjs/common';

import { OutboxPublisher } from './outbox.publisher';
import { OutboxRepository } from './outbox.repository';
import { OutboxService } from './outbox.service';
import { RedisPubSub } from './redis-pubsub';

/** Outbox + Redis Pub/Sub transport (ADR-008, ADR-009). The subscription API lives in modules/realtime. */
@Global()
@Module({
  providers: [RedisPubSub, OutboxRepository, OutboxPublisher, OutboxService],
  exports: [RedisPubSub, OutboxService, OutboxPublisher],
})
export class RealtimeInfraModule {}
