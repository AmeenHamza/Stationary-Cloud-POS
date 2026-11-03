import { Injectable } from '@nestjs/common';

import { EVENT_DEFINITIONS, MAX_EVENT_BYTES, type EventType } from '@pos/contracts';

import { TransactionalClient } from '../prisma/transactional-client';
import { AfterCommit } from '../unit-of-work/after-commit';

import { isAudience, type Audience } from './channels';
import { OutboxPublisher } from './outbox.publisher';
import { OutboxRepository } from './outbox.repository';

const PRUNE_EVERY = 1_000n;

function audienceKind(audience: Audience): 'staff' | 'admin' | 'user' {
  return audience === 'staff' || audience === 'admin' ? audience : 'user';
}

/**
 * The only way application code emits realtime events (INSTRUCTIONS.md §8): the event is written
 * in the caller's transaction and published after commit (ADR-009). Payloads are capped at
 * 1 KB (NETWORK_OPTIMIZATION.md §4.3) and the audience must match the event catalog.
 */
@Injectable()
export class OutboxService {
  constructor(
    private readonly db: TransactionalClient,
    private readonly repository: OutboxRepository,
    private readonly publisher: OutboxPublisher,
    private readonly afterCommit: AfterCommit,
  ) {}

  async add(type: EventType, audience: Audience, payload: Record<string, unknown>): Promise<void> {
    if (!this.db.inTransaction) {
      throw new Error(`Event ${type} must be added inside UnitOfWork.run().`);
    }
    const definition = EVENT_DEFINITIONS[type];
    if (!isAudience(audience) || audienceKind(audience) !== definition.audience) {
      throw new Error(`Event ${type} cannot be sent to audience "${audience}".`);
    }
    const bytes = Buffer.byteLength(JSON.stringify(payload));
    if (bytes > MAX_EVENT_BYTES) {
      throw new Error(
        `Event ${type} payload is ${String(bytes)} bytes (max ${String(MAX_EVENT_BYTES)}).`,
      );
    }
    const seq = await this.repository.insert({
      type,
      audience,
      schemaVersion: definition.schemaVersion,
      payload: payload as never,
    });
    this.afterCommit.collect('outbox', seq, (seqs: bigint[]) => this.publisher.publish(seqs));
    if (seq % PRUNE_EVERY === 0n) {
      this.afterCommit.collect('outbox-prune', seq, () => this.repository.prune());
    }
  }
}
