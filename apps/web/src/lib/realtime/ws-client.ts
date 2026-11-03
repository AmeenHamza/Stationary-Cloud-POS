import { createClient, type Client } from 'graphql-ws';

import { env } from '@/lib/env';
import { sleep } from '@/lib/timing/sleep';

import { retryDelay, shouldRetry } from './backoff';

/** Live-channel state; `offline` is derived separately from HTTP reachability. */
export type LiveStatus = 'connecting' | 'connected' | 'reconnecting';

export interface WsClientHooks {
  onStatus: (status: LiveStatus) => void;
  /** The server closed the socket with 4401: the session ended. */
  onSessionEnded: () => void;
  /** Connected again after a drop: run recovery (SYSTEM_DESIGN.md §5.5). */
  onReconnected: () => void;
}

const SESSION_ENDED = 4401;
/** Protocol ping, not polling: a few bytes, no business data (SYSTEM_DESIGN.md §5.6). */
const KEEP_ALIVE_MS = 20_000;

function socketUrl(apiUrl: string): string {
  return `${apiUrl.replace(/^http/, 'ws')}/graphql`;
}

/**
 * One `graphql-ws` client per tab (ADR-007). The browser sends the session cookie with the upgrade;
 * reconnects use jittered backoff forever except after 4401/4403.
 */
export function createWsClient(hooks: WsClientHooks): Client {
  let connectedBefore = false;
  // After any failed attempt the banner shows, even if the first connection never succeeded.
  let interrupted = false;
  return createClient({
    url: socketUrl(env.apiUrl),
    retryAttempts: Number.POSITIVE_INFINITY,
    shouldRetry,
    retryWait: (retries) => sleep(retryDelay(retries)),
    keepAlive: KEEP_ALIVE_MS,
    on: {
      connecting: () => {
        hooks.onStatus(interrupted ? 'reconnecting' : 'connecting');
      },
      connected: () => {
        hooks.onStatus('connected');
        if (connectedBefore) {
          hooks.onReconnected();
        }
        connectedBefore = true;
        interrupted = false;
      },
      closed: (event) => {
        if ((event as { code?: unknown } | null)?.code === SESSION_ENDED) {
          hooks.onSessionEnded();
          return;
        }
        interrupted = true;
        hooks.onStatus('reconnecting');
      },
    },
  });
}
