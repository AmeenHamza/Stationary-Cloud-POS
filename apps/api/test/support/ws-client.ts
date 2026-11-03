import { Redis } from 'ioredis';
import { WebSocket } from 'ws';

import { channelFor } from '../../src/infrastructure/realtime/channels';

import { testRedisUrl, within } from './services';

export type WsMessage = Record<string, unknown> & { type: string; id?: string; payload?: unknown };

export interface TestSocket {
  /** Every protocol message received so far, oldest first. */
  readonly messages: WsMessage[];
  /** Resolves with the first received message (past or future) matching `predicate`. */
  waitFor: (predicate: (message: WsMessage) => boolean, timeoutMs?: number) => Promise<WsMessage>;
  subscribe: (id: string, query: string) => void;
  /** Resolves with the close code and reason once the socket is closed. */
  readonly closed: Promise<{ code: number; reason: string }>;
  close: () => Promise<void>;
}

export interface SocketOptions {
  cookie?: string;
  origin?: string;
  /** Distinct client addresses keep the per-IP `ws-connect` limit out of leak tests. */
  forwardedFor?: string;
}

export const WEB_ORIGIN = 'http://localhost:3000';

/** Every `shopEvents` field the realtime tests assert on, per concrete event type. */
export const SHOP_EVENTS = `subscription {
  shopEvents {
    seq type __typename
    ... on ProductChangedEvent { change productId version product { id name stockPieces } }
    ... on StockChangedEvent { items { productId stockPieces isLowStock version } }
    ... on LowStockCountChangedEvent { crossedProductIds }
    ... on CategoryChangedEvent { categoryChange: change categoryId }
    ... on SettingsChangedEvent { version }
    ... on ResyncRequiredEvent { reason }
  }
}`;

/**
 * A raw `graphql-transport-ws` client: it sends `connection_init` on open and records every message
 * and the close code, so tests can assert protocol-level refusals (4401, 4403) directly.
 */
export function openSocket(baseUrl: string, options: SocketOptions = {}): TestSocket {
  const headers: Record<string, string> = { origin: options.origin ?? WEB_ORIGIN };
  if (options.cookie !== undefined) {
    headers['cookie'] = options.cookie;
  }
  if (options.forwardedFor !== undefined) {
    headers['x-forwarded-for'] = options.forwardedFor;
  }
  const ws = new WebSocket(`${baseUrl.replace(/^http/, 'ws')}/graphql`, 'graphql-transport-ws', {
    headers,
  });
  const messages: WsMessage[] = [];
  const waiters: { predicate: (message: WsMessage) => boolean; resolve: (m: WsMessage) => void }[] =
    [];
  ws.on('open', () => {
    ws.send(JSON.stringify({ type: 'connection_init' }));
  });
  ws.on('message', (data: Buffer) => {
    const message = JSON.parse(data.toString()) as WsMessage;
    messages.push(message);
    for (const waiter of waiters.filter((entry) => entry.predicate(message))) {
      waiters.splice(waiters.indexOf(waiter), 1);
      waiter.resolve(message);
    }
  });
  const closed = new Promise<{ code: number; reason: string }>((resolve) => {
    ws.on('close', (code: number, reason: Buffer) => {
      resolve({ code, reason: reason.toString() });
    });
  });
  ws.on('error', () => undefined); // a refused upgrade also emits `close`, which tests assert on

  return {
    messages,
    closed,
    waitFor: (predicate, timeoutMs = 5_000) => {
      const seen = messages.find(predicate);
      if (seen !== undefined) {
        return Promise.resolve(seen);
      }
      return within(
        new Promise<WsMessage>((resolve) => waiters.push({ predicate, resolve })),
        timeoutMs,
        'a WebSocket message',
      );
    },
    subscribe: (id, query) => {
      ws.send(JSON.stringify({ id, type: 'subscribe', payload: { query } }));
    },
    close: async () => {
      if (ws.readyState !== WebSocket.CLOSED) {
        ws.close(1000);
      }
      await closed;
    },
  };
}

/** The `shopEvents` payload of a `next` message, or undefined for other messages. */
export function eventOf(message: WsMessage): Record<string, unknown> | undefined {
  if (message.type !== 'next') {
    return undefined;
  }
  const payload = message.payload as { data?: { shopEvents?: Record<string, unknown> } };
  return payload.data?.shopEvents;
}

/** Predicate: a `shopEvents` event of the given type (e.g. `product.changed`). */
export const isEvent =
  (type: string, where: (event: Record<string, unknown>) => boolean = () => true) =>
  (message: WsMessage): boolean => {
    const event = eventOf(message);
    return event?.['type'] === type && where(event);
  };

export const isAck = (message: WsMessage): boolean => message.type === 'connection_ack';

/**
 * Opens a socket, subscribes to `shopEvents` and returns once the subscription is live: a probe
 * `system.resyncRequired` published straight to the staff channel (as another instance would) has
 * come back. Subscribing is asynchronous on the server, so tests must not trigger events earlier.
 */
export async function liveEvents(baseUrl: string, options: SocketOptions): Promise<TestSocket> {
  const socket = openSocket(baseUrl, options);
  await socket.waitFor(isAck);
  socket.subscribe('events', SHOP_EVENTS);
  const publisher = new Redis(testRedisUrl());
  try {
    for (let attempt = 1; attempt <= 20; attempt += 1) {
      const seq = `probe-${String(attempt)}`;
      const envelope = {
        seq,
        type: 'system.resyncRequired',
        schemaVersion: 1,
        occurredAt: new Date().toISOString(),
        payload: { reason: 'PROBE' },
      };
      await publisher.publish(channelFor('staff'), JSON.stringify(envelope));
      const arrived = await socket
        .waitFor(
          isEvent('system.resyncRequired', (event) => event['reason'] === 'PROBE'),
          250,
        )
        .then(() => true)
        .catch(() => false);
      if (arrived) {
        return socket;
      }
    }
  } finally {
    await publisher.quit();
  }
  throw new Error(`shopEvents never became live: ${JSON.stringify(socket.messages.slice(0, 3))}`);
}
