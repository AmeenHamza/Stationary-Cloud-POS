import { Injectable } from '@nestjs/common';

import { CacheKeys } from '../../../infrastructure/cache/cache-keys';
import { CacheService } from '../../../infrastructure/cache/cache.service';
import { userAudience } from '../../../infrastructure/realtime/channels';
import { OutboxService } from '../../../infrastructure/realtime/outbox.service';
import { AfterCommit } from '../../../infrastructure/unit-of-work/after-commit';
import {
  SessionsRepository,
  type RevokeReason,
  type RevokeTarget,
} from '../persistence/sessions.repository';

import { tokenHashHex } from './session-token';
import { REVOKED_MARKER, SESSION_CACHE_TTL_SECONDS } from './session.service';

/** Session ids per `session.revoked` event, keeping each payload under 1 KB. */
const IDS_PER_EVENT = 20;

/**
 * Revokes sessions inside the caller's transaction (SYSTEM_DESIGN.md §2.3): marks rows revoked, adds
 * `session.revoked` to the outbox so every instance closes the sockets, and after commit writes cache
 * tombstones. If Redis is down, PostgreSQL still rejects revoked sessions on the next cache miss.
 */
@Injectable()
export class SessionRevocationService {
  constructor(
    private readonly sessions: SessionsRepository,
    private readonly outbox: OutboxService,
    private readonly afterCommit: AfterCommit,
    private readonly cache: CacheService,
  ) {}

  async revoke(target: RevokeTarget, reason: RevokeReason): Promise<number> {
    const revoked = await this.sessions.revoke(target, reason);
    const byUser = new Map<string, string[]>();
    for (const session of revoked) {
      byUser.set(session.userId, [...(byUser.get(session.userId) ?? []), session.id]);
      const key = CacheKeys.session(tokenHashHex(session.tokenHash));
      this.afterCommit.collect('session-tombstones', key, (keys: string[]) => this.tombstone(keys));
    }
    for (const [userId, sessionIds] of byUser) {
      for (let start = 0; start < sessionIds.length; start += IDS_PER_EVENT) {
        await this.outbox.add('session.revoked', userAudience(userId), {
          sessionIds: sessionIds.slice(start, start + IDS_PER_EVENT),
        });
      }
    }
    return revoked.length;
  }

  private async tombstone(keys: readonly string[]): Promise<void> {
    for (const key of keys) {
      await this.cache.setRaw(key, REVOKED_MARKER, SESSION_CACHE_TTL_SECONDS, false);
    }
  }
}
