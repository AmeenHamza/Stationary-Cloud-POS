import { Injectable } from '@nestjs/common';

import { EVENT_DEFINITIONS, MAX_EVENT_BYTES, type EventType } from '@pos/contracts';

import { TransactionalClient } from '../prisma/transactional-client';
import { AfterCommit } from '../unit-of-work/after-commit';

import { isAudience, type Audience } from './channels';
import { sliceUnderLimit } from './event-slices';
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

  add(type: EventType, audience: Audience, payload: Record<string, unknown>): Promise<void> {
    return this.addAll(type, audience, [payload]);
  }

  /**
   * One event per slice of `items` under `field`, each within 1 KB: a bill of up to 100 lines
   * touches more products than one event can carry. Every item names its product and version, so
   * clients apply the slices independently and in any order. All slices go in one INSERT.
   */
  addSliced(
    type: EventType,
    audience: Audience,
    field: string,
    items: readonly unknown[],
  ): Promise<void> {
    return this.addAll(
      type,
      audience,
      sliceUnderLimit(field, items).map((slice) => ({ [field]: slice })),
    );
  }

  private async addAll(
    type: EventType,
    audience: Audience,
    payloads: readonly Record<string, unknown>[],
  ): Promise<void> {
    if (payloads.length === 0) {
      return; // nothing changed (e.g. no product crossed its threshold)
    }
    if (!this.db.inTransaction) {
      throw new Error(`Event ${type} must be added inside UnitOfWork.run().`);
    }
    const definition = EVENT_DEFINITIONS[type];
    if (!isAudience(audience) || audienceKind(audience) !== definition.audience) {
      throw new Error(`Event ${type} cannot be sent to audience "${audience}".`);
    }
    for (const payload of payloads) {
      const bytes = Buffer.byteLength(JSON.stringify(payload));
      if (bytes > MAX_EVENT_BYTES) {
        throw new Error(
          `Event ${type} payload is ${String(bytes)} bytes (max ${String(MAX_EVENT_BYTES)}).`,
        );
      }
    }
    const seqs = await this.repository.insertAll(
      payloads.map((payload) => ({
        type,
        audience,
        schemaVersion: definition.schemaVersion,
        payload: payload as never,
      })),
    );
    for (const seq of seqs) {
      this.afterCommit.collect('outbox', seq, (all: bigint[]) => this.publisher.publish(all));
      if (seq % PRUNE_EVERY === 0n) {
        this.afterCommit.collect('outbox-prune', seq, () => this.repository.prune());
      }
    }
  }
}
