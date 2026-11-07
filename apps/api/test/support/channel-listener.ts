import { Redis } from 'ioredis';

import { testRedisUrl, within } from './services';

export interface ChannelListener {
  /** Distinct messages received so far, oldest first. */
  readonly messages: string[];
  /** Resolves with the next message not yet taken (fails after `timeoutMs`). */
  next: (timeoutMs?: number) => Promise<string>;
  close: () => Promise<void>;
}

/**
 * Observes Redis channels directly (not through the API under test), the way another API
 * instance would, to prove what was actually published. Publication is at-least-once (API.md
 * "Duplicates", ADR-010), so a repeated `seq` is dropped here, exactly as clients drop it: the fast
 * path after a commit can race the drain that runs when Redis connects. An event that should never
 * have been published still shows up, because it has its own `seq`.
 */
export async function listenTo(channels: readonly string[]): Promise<ChannelListener> {
  const client = new Redis(testRedisUrl());
  const messages: string[] = [];
  const waiters: ((message: string) => void)[] = [];
  const seen = new Set<string>();
  let taken = 0;

  client.on('message', (_channel: string, message: string) => {
    const { seq } = JSON.parse(message) as { seq: string };
    if (seen.has(seq)) {
      return;
    }
    seen.add(seq);
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
