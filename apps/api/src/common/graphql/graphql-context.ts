import { randomUUID } from 'node:crypto';

import { assignedRequestId } from '../logging/request-id';

import type { WsContext } from './ws-lifecycle';
import type { Request, Response } from 'express';
import type { IncomingMessage } from 'node:http';
import type { WebSocket } from 'ws';

/** Queries and mutations over HTTP (the only transport that can set cookies). */
export interface HttpGraphqlContext {
  transport: 'http';
  req: Request;
  res: Response;
  requestId: string;
}

/** The `shopEvents` subscription over WebSocket; `req` is the upgrade request (cookie, origin). */
export interface WsGraphqlContext {
  transport: 'ws';
  req: IncomingMessage;
  socket: WebSocket;
  requestId: string;
}

export type GraphqlContext = HttpGraphqlContext | WsGraphqlContext;

interface HttpInput {
  req: Request;
  res: Response;
}

/**
 * One context builder for both transports: Apollo passes `{ req, res }` for HTTP, graphql-ws passes
 * its connection context (with `extra.socket` and `extra.request`) for each subscription.
 */
export function buildContext(input: HttpInput | WsContext): GraphqlContext {
  if ('extra' in input) {
    return {
      transport: 'ws',
      req: input.extra.request,
      socket: input.extra.socket,
      requestId: randomUUID(),
    };
  }
  return {
    transport: 'http',
    req: input.req,
    res: input.res,
    requestId: assignedRequestId(input.req),
  };
}
