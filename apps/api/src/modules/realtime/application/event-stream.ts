import { randomUUID } from 'node:crypto';

import { EVENT_DEFINITIONS, type EventDefinition } from '@pos/contracts';

import {
  decodeEnvelope,
  type EventEnvelope,
} from '../../../infrastructure/realtime/event-envelope';

import type { RedisPubSub } from '../../../infrastructure/realtime/redis-pubsub';

/** A `shopEvents` payload: the envelope's fields plus the event's own payload fields. */
export type ShopEventValue = Record<string, unknown> & { seq: string; type: string };

/** Events waiting for a slow socket; beyond this the client is told to resync instead. */
const MAX_QUEUED = 500;

export interface StreamOptions {
  channels: readonly string[];
  sessionId: string;
  /** ClockService time, for synthetic resync events. */
  now: () => Date;
  /** Called when this stream's own session is revoked (the socket is closed with 4401). */
  onRevoked: () => void;
  onClosed: () => void;
}

function toValue(envelope: EventEnvelope): ShopEventValue {
  return {
    ...envelope.payload,
    seq: envelope.seq,
    type: envelope.type,
    schemaVersion: envelope.schemaVersion,
    occurredAt: new Date(envelope.occurredAt),
  };
}

export function resyncValue(occurredAt: Date): ShopEventValue {
  return {
    seq: `resync-${randomUUID()}`,
    type: 'system.resyncRequired',
    schemaVersion: EVENT_DEFINITIONS['system.resyncRequired'].schemaVersion,
    occurredAt,
    reason: 'REDIS_RECONNECTED',
  };
}

/**
 * The async iterator behind one `shopEvents` subscription. graphql-ws calls `return()` on complete
 * or disconnect, which unsubscribes the Redis channels (no leaks, RT-05). Server-internal events are
 * never forwarded; `session.revoked` for this socket's session closes it.
 */
export class EventStream implements AsyncIterableIterator<ShopEventValue> {
  private readonly queue: ShopEventValue[] = [];
  private readonly waiting: ((result: IteratorResult<ShopEventValue>) => void)[] = [];
  private readonly unsubscribe: Promise<() => Promise<void>>;
  private done = false;

  constructor(
    pubsub: RedisPubSub,
    private readonly options: StreamOptions,
  ) {
    this.unsubscribe = pubsub
      .subscribe(options.channels, (message) => {
        this.receive(message);
      })
      .catch(() => () => Promise.resolve());
  }

  push(value: ShopEventValue): void {
    if (this.done) {
      return;
    }
    const waiter = this.waiting.shift();
    if (waiter !== undefined) {
      waiter({ value, done: false });
      return;
    }
    this.queue.push(value);
    if (this.queue.length > MAX_QUEUED) {
      this.queue.length = 0; // a resync refetches what the client shows, so nothing is lost
      this.queue.push(resyncValue(this.options.now()));
    }
  }

  next(): Promise<IteratorResult<ShopEventValue>> {
    const value = this.queue.shift();
    if (value !== undefined) {
      return Promise.resolve({ value, done: false });
    }
    if (this.done) {
      return Promise.resolve({ value: undefined, done: true });
    }
    return new Promise((resolve) => this.waiting.push(resolve));
  }

  async return(): Promise<IteratorResult<ShopEventValue>> {
    if (!this.done) {
      this.done = true;
      this.queue.length = 0;
      for (const waiter of this.waiting.splice(0)) {
        waiter({ value: undefined, done: true });
      }
      await (
        await this.unsubscribe
      )();
      this.options.onClosed();
    }
    return { value: undefined, done: true };
  }

  [Symbol.asyncIterator](): this {
    return this;
  }

  private receive(message: string): void {
    const envelope = decodeEnvelope(message);
    if (envelope === null) {
      return;
    }
    if (envelope.type === 'session.revoked') {
      const ids = envelope.payload['sessionIds'];
      if (Array.isArray(ids) && ids.includes(this.options.sessionId)) {
        this.options.onRevoked();
        void this.return();
      }
      return;
    }
    if ((EVENT_DEFINITIONS[envelope.type] as EventDefinition).internal !== true) {
      this.push(toValue(envelope));
    }
  }
}
