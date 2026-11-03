import { print } from 'graphql';
import { WebSocket } from 'ws';

import type { DocumentNode } from 'graphql';

/** WebSocket traffic of one tab's live channel (M3, NETWORK_OPTIMIZATION.md §4.3). */
export interface LiveChannel {
  readonly received: number;
  readonly sent: number;
  readonly events: number;
  readonly largestEvent: number;
  close: () => Promise<void>;
}

/**
 * The `shopEvents` subscription over `graphql-transport-ws`, as the browser opens it (cookie and
 * origin on the upgrade). Resolves once the subscription is sent after `connection_ack`.
 */
export async function openLiveChannel(
  apiUrl: string,
  origin: string,
  cookie: string,
  subscription: DocumentNode,
  /** Called with each event's `__typename`, e.g. to refetch like the screen would. */
  onEvent: (typename: string) => void = () => undefined,
): Promise<LiveChannel> {
  const socket = new WebSocket(`${apiUrl.replace(/^http/, 'ws')}/graphql`, 'graphql-transport-ws', {
    headers: { origin, cookie },
  });
  const channel = { received: 0, sent: 0, events: 0, largestEvent: 0 };
  const send = (message: object): void => {
    const text = JSON.stringify(message);
    channel.sent += Buffer.byteLength(text);
    socket.send(text);
  };
  await new Promise<void>((resolve, reject) => {
    socket.once('error', reject);
    socket.once('close', (code: number, reason: Buffer) => {
      reject(new Error(`live channel closed before ready: ${String(code)} ${reason.toString()}`));
    });
    socket.on('open', () => {
      send({ type: 'connection_init', payload: {} });
    });
    socket.on('message', (data: Buffer) => {
      channel.received += data.length;
      const message = JSON.parse(data.toString('utf8')) as {
        type: string;
        payload?: { data?: { shopEvents?: { __typename?: string } } };
      };
      if (message.type === 'connection_ack') {
        send({ id: '1', type: 'subscribe', payload: { query: print(subscription) } });
        resolve();
      } else if (message.type === 'next') {
        channel.events += 1;
        channel.largestEvent = Math.max(channel.largestEvent, data.length);
        onEvent(message.payload?.data?.shopEvents?.__typename ?? 'unknown');
      } else if (message.type === 'ping') {
        send({ type: 'pong' });
      }
    });
  });
  return {
    get received() {
      return channel.received;
    },
    get sent() {
      return channel.sent;
    },
    get events() {
      return channel.events;
    },
    get largestEvent() {
      return channel.largestEvent;
    },
    close: async () => {
      const closed = new Promise((resolve) => socket.once('close', resolve));
      socket.close(1000);
      await closed;
    },
  };
}
