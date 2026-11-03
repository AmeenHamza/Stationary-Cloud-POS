import { isIP } from 'node:net';

import { Injectable } from '@nestjs/common';
import { CLS_REQ, ClsService } from 'nestjs-cls';

import { assignedRequestId } from '../logging/request-id';

import type { Request } from 'express';

/** Who is calling: stored on sessions and audit rows (DATABASE.md §4.2, §4.14). Never logged raw. */
export interface ClientInfo {
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
}

const USER_AGENT_MAX = 200;
const NO_CLIENT: ClientInfo = { ip: null, userAgent: null, requestId: null };

export function clientInfoOf(request: Request): ClientInfo {
  const ip = request.ip ?? '';
  const userAgent = request.headers['user-agent'];
  return {
    ip: isIP(ip) === 0 ? null : ip, // honours TRUST_PROXY_HOPS via Express `trust proxy`
    userAgent: userAgent === undefined ? null : userAgent.slice(0, USER_AGENT_MAX),
    requestId: assignedRequestId(request),
  };
}

/** The current HTTP request's client info, read from CLS so services need not pass it around. */
@Injectable()
export class RequestContext {
  constructor(private readonly cls: ClsService) {}

  client(): ClientInfo {
    const request = this.cls.isActive() ? this.cls.get<Request | undefined>(CLS_REQ) : undefined;
    return request === undefined ? NO_CLIENT : clientInfoOf(request);
  }
}
