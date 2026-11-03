import { Injectable } from '@nestjs/common';

import { ClockService } from '../../../common/time/clock.service';
import { RedisPubSub } from '../../../infrastructure/realtime/redis-pubsub';
import { RedisStatus } from '../../../infrastructure/redis/redis-status';

import { channelsFor, WS_CLOSE } from './event-audience';
import { EventStream, resyncValue } from './event-stream';

import type { Principal } from '../../../common/auth/principal';
import type { WebSocket } from 'ws';

/**
 * This instance's open `shopEvents` streams. When its Redis subscriber reconnects it may have missed
 * messages, so every stream gets `system.resyncRequired` (SYSTEM_DESIGN.md §5.5, RT-09).
 */
@Injectable()
export class RealtimeHub {
  private readonly streams = new Map<WebSocket, Set<EventStream>>();

  constructor(
    private readonly pubsub: RedisPubSub,
    private readonly clock: ClockService,
    status: RedisStatus,
  ) {
    status.onReady(
      'subscriber',
      () => {
        this.resyncAll();
      },
      { reconnectOnly: true },
    );
  }

  open(principal: Principal, socket: WebSocket): EventStream {
    const stream: EventStream = new EventStream(this.pubsub, {
      channels: channelsFor(principal),
      sessionId: principal.sessionId,
      now: () => this.clock.now(),
      onRevoked: () => {
        socket.close(WS_CLOSE.unauthenticated, 'Session ended');
      },
      onClosed: () => {
        this.forget(socket, stream);
      },
    });
    const set = this.streams.get(socket) ?? new Set<EventStream>();
    set.add(stream);
    this.streams.set(socket, set);
    return stream;
  }

  /** Open streams on this instance (leak checks, RT-05). */
  streamCount(): number {
    let total = 0;
    for (const set of this.streams.values()) {
      total += set.size;
    }
    return total;
  }

  resyncAll(): void {
    for (const set of this.streams.values()) {
      for (const stream of set) {
        stream.push(resyncValue(this.clock.now()));
      }
    }
  }

  private forget(socket: WebSocket, stream: EventStream): void {
    const set = this.streams.get(socket);
    set?.delete(stream);
    if (set?.size === 0) {
      this.streams.delete(socket);
    }
  }
}
