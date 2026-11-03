import { EventEmitter } from 'node:events';

import { describe, expect, it, vi } from 'vitest';

import { channelFor, isAudience, userAudience } from './channels';
import { decodeEnvelope, encodeEnvelope, type EventEnvelope } from './event-envelope';
import { RedisPubSub } from './redis-pubsub';

import type { Redis } from 'ioredis';

const USER = '0190f3a4-0000-7000-8000-000000000001';

describe('channels', () => {
  it('accepts staff, admin and user audiences only', () => {
    expect(isAudience('staff')).toBe(true);
    expect(isAudience('admin')).toBe(true);
    expect(isAudience(userAudience(USER))).toBe(true);
    expect(isAudience('user:someone')).toBe(false);
    expect(isAudience('everyone')).toBe(false);
    expect(channelFor('staff')).toBe('pos:v1:ev:staff');
  });
});

describe('event envelope', () => {
  const envelope: EventEnvelope = {
    seq: '42',
    type: 'stock.changed',
    schemaVersion: 1,
    occurredAt: '2026-10-29T10:00:00.000Z',
    payload: { productId: USER, stockPieces: 5 },
  };

  it('round-trips', () => {
    expect(decodeEnvelope(encodeEnvelope(envelope))).toEqual(envelope);
  });

  it.each([
    ['not json', '{'],
    ['unknown type', JSON.stringify({ ...envelope, type: 'stock.exploded' })],
    ['numeric seq', JSON.stringify({ ...envelope, seq: 42 })],
    ['null payload', JSON.stringify({ ...envelope, payload: null })],
  ])('ignores %s', (_label, message) => {
    expect(decodeEnvelope(message)).toBeNull();
  });
});

/** Minimal ioredis stand-in: an emitter with the commands RedisPubSub uses. */
function fakeRedis() {
  const client = Object.assign(new EventEmitter(), {
    publish: vi.fn(() => Promise.resolve(1)),
    subscribe: vi.fn(() => Promise.resolve(1)),
    unsubscribe: vi.fn(() => Promise.resolve(1)),
  });
  return { client, redis: client as unknown as Redis };
}

describe('RedisPubSub (RT-05: no leaked subscriptions)', () => {
  it('subscribes a channel once, fans out, and unsubscribes after the last handler', async () => {
    const publisher = fakeRedis();
    const subscriber = fakeRedis();
    const pubsub = new RedisPubSub(publisher.redis, subscriber.redis);
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = await pubsub.subscribe(['a', 'b'], first);
    const stopSecond = await pubsub.subscribe(['a'], second);
    expect(subscriber.client.subscribe).toHaveBeenCalledTimes(1);
    expect(subscriber.client.subscribe).toHaveBeenCalledWith('a', 'b');

    subscriber.client.emit('message', 'a', 'hello');
    expect(first).toHaveBeenCalledWith('hello');
    expect(second).toHaveBeenCalledWith('hello');

    await stopFirst();
    await stopFirst(); // idempotent
    expect(subscriber.client.unsubscribe).toHaveBeenCalledWith('b');
    expect(pubsub.channelCount).toBe(1);
    await stopSecond();
    expect(subscriber.client.unsubscribe).toHaveBeenLastCalledWith('a');
    expect(pubsub.channelCount).toBe(0);
  });

  it('rolls back local handlers when SUBSCRIBE fails', async () => {
    const subscriber = fakeRedis();
    subscriber.client.subscribe.mockRejectedValueOnce(new Error('Connection is closed.'));
    const pubsub = new RedisPubSub(fakeRedis().redis, subscriber.redis);
    await expect(pubsub.subscribe(['a'], vi.fn())).rejects.toThrow('Connection is closed.');
    expect(pubsub.channelCount).toBe(0);
  });

  it('publishes through the publisher connection', async () => {
    const publisher = fakeRedis();
    const pubsub = new RedisPubSub(publisher.redis, fakeRedis().redis);
    await pubsub.publish('pos:v1:ev:staff', '{}');
    expect(publisher.client.publish).toHaveBeenCalledWith('pos:v1:ev:staff', '{}');
  });
});
