import { Redis } from 'ioredis';

import { testRedisUrl, within } from './services';

export interface ChannelListener {
  /** Messages received so far, oldest first. */
  readonly messages: string[];
  /** Resolves with the next message not yet taken (fails after `timeoutMs`). */
  next: (timeoutMs?: number) => Promise<string>;
  close: () => Promise<void>;
}

/**
 * Observes Redis channels directly (not through the API under test), the way another API
 * instance would, to prove what was actually published.
 */
export async function listenTo(channels: readonly string[]): Promise<ChannelListener> {
  const client = new Redis(testRedisUrl());
  const messages: string[] = [];
  const waiters: ((message: string) => void)[] = [];
  let taken = 0;

  client.on('message', (_channel: string, message: string) => {
    messages.push(message);
    const waiter = waiters.shift();
    if (waiter !== undefined) {
      taken += 1;
      waiter(message);
    }
  });
  await client.subscribe(...channels);

  return {
    messages,
    next: (timeoutMs = 5_000) => {
      if (taken < messages.length) {
        const message = messages[taken];
        taken += 1;
        return Promise.resolve(message ?? '');
      }
      return within(
        new Promise<string>((resolve) => waiters.push(resolve)),
        timeoutMs,
        'a message',
      );
    },
    close: async () => {
      await client.quit();
    },
  };
}
