import { isIP } from 'node:net';

import { Inject, Injectable } from '@nestjs/common';
import { GraphQLError, OperationTypeNode, getOperationAST, parse } from 'graphql';

import { PRINCIPAL_RESOLVER, type PrincipalResolver } from '../../../common/auth/principal';
import { APP_CONFIG, type AppConfig } from '../../../config/app-config';
import { MetricsService } from '../../../infrastructure/metrics/metrics.service';
import { RateLimiterService } from '../../../infrastructure/rate-limit/rate-limiter.service';

import { WS_CLOSE } from './event-audience';

import type { WsContext, WsLifecycle } from '../../../common/graphql/ws-lifecycle';
import type { SubscribePayload } from 'graphql-ws' with { 'resolution-mode': 'import' };
import type { IncomingMessage } from 'node:http';
import type { WebSocket } from 'ws';

const MAX_SOCKETS_PER_USER = 10;
const MAX_SUBSCRIPTIONS_PER_SOCKET = 3;

/**
 * WebSocket authentication and limits (SYSTEM_DESIGN.md §2.5): Origin must be the web app, the
 * `ws-connect` rate limit applies per IP, the session cookie must resolve, and one user may hold at
 * most 10 sockets on this instance. Only subscriptions run over the socket.
 */
@Injectable()
export class WsConnectionService implements WsLifecycle {
  private readonly socketsByUser = new Map<string, Set<WebSocket>>();
  private readonly userBySocket = new Map<WebSocket, string>();

  constructor(
    @Inject(PRINCIPAL_RESOLVER) private readonly sessions: PrincipalResolver,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly limiter: RateLimiterService,
    private readonly metrics: MetricsService,
  ) {}

  async onConnect(ctx: WsContext): Promise<boolean> {
    const { socket, request } = ctx.extra;
    if (request.headers.origin !== this.config.WEB_ORIGIN) {
      return this.refuse(socket, WS_CLOSE.forbidden, 'Forbidden origin');
    }
    try {
      await this.limiter.consume('ws-connect', this.clientIp(request));
    } catch {
      return this.refuse(socket, WS_CLOSE.tooMany, 'Too many connections');
    }
    const principal = await this.sessions.resolve(request);
    if (principal === null) {
      return this.refuse(socket, WS_CLOSE.unauthenticated, 'Unauthorized');
    }
    const sockets = this.socketsByUser.get(principal.userId) ?? new Set<WebSocket>();
    if (sockets.size >= MAX_SOCKETS_PER_USER) {
      return this.refuse(socket, WS_CLOSE.tooMany, 'Too many connections');
    }
    sockets.add(socket);
    this.socketsByUser.set(principal.userId, sockets);
    this.userBySocket.set(socket, principal.userId);
    this.metrics.wsConnections.inc();
    return true;
  }

  onSubscribe(
    ctx: WsContext,
    _id: string,
    payload: SubscribePayload,
  ): readonly GraphQLError[] | undefined {
    let operation: ReturnType<typeof getOperationAST>;
    try {
      operation = getOperationAST(parse(payload.query), payload.operationName);
    } catch {
      return [new GraphQLError('Invalid query.', { extensions: { code: 'BAD_USER_INPUT' } })];
    }
    if (operation?.operation !== OperationTypeNode.SUBSCRIPTION) {
      return [
        new GraphQLError('Queries and mutations use HTTP.', {
          extensions: { code: 'BAD_USER_INPUT' },
        }),
      ];
    }
    // graphql-ws reserves each id in `ctx.subscriptions` before this hook runs, so the count already
    // includes this one and subscriptions sent together cannot all slip under the cap.
    if (Object.keys(ctx.subscriptions).length > MAX_SUBSCRIPTIONS_PER_SOCKET) {
      return [
        new GraphQLError('Too many subscriptions.', { extensions: { code: 'RATE_LIMITED' } }),
      ];
    }
    return undefined;
  }

  onDisconnect(ctx: WsContext): void {
    const socket = ctx.extra.socket;
    const userId = this.userBySocket.get(socket);
    this.userBySocket.delete(socket);
    if (userId !== undefined) {
      this.metrics.wsConnections.dec();
      const sockets = this.socketsByUser.get(userId);
      sockets?.delete(socket);
      if (sockets?.size === 0) {
        this.socketsByUser.delete(userId);
      }
    }
  }

  /** Registered sockets on this instance (leak checks, RT-05). */
  get socketCount(): number {
    return this.userBySocket.size;
  }

  private refuse(socket: WebSocket, code: number, reason: string): false {
    socket.close(code, reason);
    return false;
  }

  /** The client IP, honouring TRUST_PROXY_HOPS like Express's `trust proxy` does for HTTP. */
  private clientIp(request: IncomingMessage): string {
    const forwarded = String(request.headers['x-forwarded-for'] ?? '')
      .split(',')
      .map((part) => part.trim())
      .filter((part) => isIP(part) !== 0);
    const hops = this.config.TRUST_PROXY_HOPS;
    const fromProxy = hops > 0 ? forwarded.at(-hops) : undefined;
    return fromProxy ?? request.socket.remoteAddress ?? 'unknown';
  }
}
