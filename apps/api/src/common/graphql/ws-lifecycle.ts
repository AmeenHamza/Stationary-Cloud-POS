import type { GraphQLError } from 'graphql';
import type { Context, SubscribePayload } from 'graphql-ws' with { 'resolution-mode': 'import' };
import type { IncomingMessage } from 'node:http';
import type { WebSocket } from 'ws';

// @nestjs/graphql is ESM, so the graphql-ws types it uses come from the ESM declarations; match them.

/** What `graphql-ws` (with the `ws` server) gives each connection. */
export interface WsExtra {
  socket: WebSocket;
  request: IncomingMessage;
}

export type WsContext = Context<Record<string, unknown> | undefined, WsExtra>;

/**
 * WebSocket connection hooks (SYSTEM_DESIGN.md §2.5), implemented by the realtime module and
 * provided under WS_LIFECYCLE so the GraphQL module in `common` imports no module.
 */
export interface WsLifecycle {
  onConnect: (ctx: WsContext) => Promise<boolean>;
  onSubscribe: (
    ctx: WsContext,
    id: string,
    payload: SubscribePayload,
  ) => readonly GraphQLError[] | undefined;
  onDisconnect: (ctx: WsContext) => void;
}

export const WS_LIFECYCLE = Symbol('WS_LIFECYCLE');

/**
 * Nest types the hook context with an untyped `extra`; its `ws` server (`graphql-ws/use/ws`) always
 * passes `{ socket, request }`. This is the one place that states it.
 */
export function asWsContext(ctx: Context): WsContext {
  return ctx as unknown as WsContext;
}
