import { randomUUID } from 'node:crypto';

import type { IncomingMessage } from 'node:http';

const REQUEST_ID = /^[\w-]{8,64}$/;

/** pino-http `genReqId`: reuses a well-formed incoming x-request-id (from the edge), else a new one. */
export function requestIdOf(request: IncomingMessage): string {
  const incoming = request.headers['x-request-id'];
  return typeof incoming === 'string' && REQUEST_ID.test(incoming) ? incoming : randomUUID();
}

/** The id pino-http assigned to this request, so errors and logs carry the same value. */
export function assignedRequestId(request: { readonly id?: unknown }): string {
  const id = request.id;
  return typeof id === 'string' && id !== '' ? id : randomUUID();
}
