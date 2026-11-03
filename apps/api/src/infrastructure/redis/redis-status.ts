import { Injectable, Logger } from '@nestjs/common';

import { MetricsService } from '../metrics/metrics.service';

import type { RedisRole } from './redis.clients';
import type { Redis } from 'ioredis';

type ReadyListener = () => Promise<void> | void;

interface Registration {
  listener: ReadyListener;
  reconnectOnly: boolean;
}

/**
 * Tracks each Redis client's connection state and notifies listeners when it becomes ready, e.g.
 * to drain the outbox or tell sockets to resync (SYSTEM_DESIGN.md §5.2, §5.5). Event-driven only.
 */
@Injectable()
export class RedisStatus {
  private readonly logger = new Logger(RedisStatus.name);
  private readonly ready = new Map<RedisRole, boolean>();
  private readonly connectedBefore = new Set<RedisRole>();
  private readonly listeners = new Map<RedisRole, Registration[]>();
  private stopping = false;

  constructor(private readonly metrics: MetricsService) {}

  watch(role: RedisRole, client: Redis): void {
    this.setReady(role, false);
    client.on('ready', () => {
      const reconnect = this.connectedBefore.has(role);
      this.connectedBefore.add(role);
      this.setReady(role, true);
      this.notify(role, reconnect);
    });
    client.on('close', () => {
      this.setReady(role, false);
    });
    client.on('error', (error: Error) => {
      if (this.stopping) {
        return; // Commands aborted by our own disconnect during shutdown are expected.
      }
      this.metrics.redisErrors.inc({ role });
      this.logger.warn({ role, reason: error.message }, 'Redis connection problem');
    });
  }

  /** Called on shutdown, before the clients disconnect. */
  stop(): void {
    this.stopping = true;
  }

  isReady(role: RedisRole): boolean {
    return this.ready.get(role) ?? false;
  }

  /** Calls `listener` on every ready event, or only on reconnects when `reconnectOnly`. */
  onReady(role: RedisRole, listener: ReadyListener, options = { reconnectOnly: false }): void {
    const registrations = this.listeners.get(role) ?? [];
    registrations.push({ listener, reconnectOnly: options.reconnectOnly });
    this.listeners.set(role, registrations);
  }

  private setReady(role: RedisRole, value: boolean): void {
    this.ready.set(role, value);
    this.metrics.redisUp.set({ role }, value ? 1 : 0);
  }

  private notify(role: RedisRole, reconnect: boolean): void {
    for (const { listener, reconnectOnly } of this.listeners.get(role) ?? []) {
      if (reconnect || !reconnectOnly) {
        Promise.resolve()
          .then(listener)
          .catch((error: unknown) => {
            this.logger.warn({ err: error, role }, 'Redis ready listener failed');
          });
      }
    }
  }
}
