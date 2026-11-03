import { Inject, Injectable } from '@nestjs/common';

import { REDIS_CLIENT } from '../redis/redis.clients';

import type { Redis } from 'ioredis';

type MessageHandler = (message: string) => void;

/**
 * Thin Pub/Sub over ioredis (ADR-008). Channels are reference-counted: Redis is subscribed while at
 * least one handler listens and unsubscribed when the last one leaves, so closed sockets never leave
 * subscriptions behind (SYSTEM_DESIGN.md §5.7). Not durable: durability comes from the outbox.
 */
@Injectable()
export class RedisPubSub {
  private readonly handlers = new Map<string, Set<MessageHandler>>();

  constructor(
    @Inject(REDIS_CLIENT.publisher) private readonly publisher: Redis,
    @Inject(REDIS_CLIENT.subscriber) private readonly subscriber: Redis,
  ) {
    this.subscriber.on('message', (channel: string, message: string) => {
      this.handlers.get(channel)?.forEach((handler) => {
        handler(message);
      });
    });
  }

  async publish(channel: string, message: string): Promise<void> {
    await this.publisher.publish(channel, message);
  }

  /** Subscribes `handler` to `channels`; resolves to an idempotent unsubscribe function. */
  async subscribe(
    channels: readonly string[],
    handler: MessageHandler,
  ): Promise<() => Promise<void>> {
    const fresh: string[] = [];
    for (const channel of channels) {
      let set = this.handlers.get(channel);
      if (set === undefined) {
        set = new Set();
        this.handlers.set(channel, set);
        fresh.push(channel);
      }
      set.add(handler);
    }
    if (fresh.length > 0) {
      try {
        await this.subscriber.subscribe(...fresh);
      } catch (error) {
        await this.release(channels, handler); // leave no half-registered handler behind
        throw error;
      }
    }
    let active = true;
    return async () => {
      if (!active) {
        return;
      }
      active = false;
      await this.release(channels, handler);
    };
  }

  /** Number of channels with at least one local handler (leak checks, RT-05). */
  get channelCount(): number {
    return this.handlers.size;
  }

  private async release(channels: readonly string[], handler: MessageHandler): Promise<void> {
    const idle: string[] = [];
    for (const channel of channels) {
      const set = this.handlers.get(channel);
      set?.delete(handler);
      if (set?.size === 0) {
        this.handlers.delete(channel);
        idle.push(channel);
      }
    }
    if (idle.length > 0) {
      await this.subscriber.unsubscribe(...idle).catch(() => undefined);
    }
  }
}
