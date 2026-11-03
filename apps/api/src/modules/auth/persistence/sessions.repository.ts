import { Injectable } from '@nestjs/common';

import { TransactionalClient } from '../../../infrastructure/prisma/transactional-client';

import type { TokenHash } from '../application/session-token';
import type { UserRole } from '@pos/contracts';

export interface NewSession {
  userId: string;
  tokenHash: TokenHash;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  ip: string | null;
  userAgent: string | null;
}

export interface ActiveSession {
  id: string;
  userId: string;
  role: UserRole;
  lastSeenAt: Date;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
}

export interface RevokedSession {
  id: string;
  userId: string;
  tokenHash: Uint8Array;
}

export type RevokeReason =
  | 'LOGOUT'
  | 'PASSWORD_CHANGED'
  | 'DISABLED'
  | 'ADMIN_RESET'
  | 'ROLE_CHANGED'
  /** Every session ended at once after a leaked secret (`cli/revoke-all-sessions.ts`). */
  | 'SECURITY_RESET';

export type RevokeTarget =
  { sessionId: string } | { userId: string; exceptSessionId?: string } | { everyone: true };

/** Persistence for `sessions` (DATABASE.md §4.2). */
@Injectable()
export class SessionsRepository {
  constructor(private readonly db: TransactionalClient) {}

  async insert(session: NewSession): Promise<string> {
    const row = await this.db.client.session.create({ data: session, select: { id: true } });
    return row.id;
  }

  /** Not revoked, neither expiry passed, user ACTIVE. */
  async findActive(tokenHash: TokenHash, now: Date): Promise<ActiveSession | null> {
    const row = await this.db.client.session.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        idleExpiresAt: { gt: now },
        absoluteExpiresAt: { gt: now },
        user: { status: 'ACTIVE' },
      },
      select: {
        id: true,
        userId: true,
        lastSeenAt: true,
        idleExpiresAt: true,
        absoluteExpiresAt: true,
        user: { select: { role: true } },
      },
    });
    return row === null ? null : { ...row, role: row.user.role };
  }

  async touch(sessionId: string, now: Date, idleExpiresAt: Date): Promise<void> {
    await this.db.client.session.update({
      where: { id: sessionId },
      data: { lastSeenAt: now, idleExpiresAt },
      select: { id: true },
    });
  }

  /** Revokes and returns the affected sessions (their hashes become cache tombstones). */
  revoke(target: RevokeTarget, reason: RevokeReason): Promise<RevokedSession[]> {
    const client = this.db.client;
    if ('everyone' in target) {
      return client.$queryRaw<RevokedSession[]>`
        UPDATE sessions SET revoked_at = now(), revoke_reason = ${reason}
        WHERE revoked_at IS NULL
        RETURNING id, user_id AS "userId", token_hash AS "tokenHash"`;
    }
    if ('sessionId' in target) {
      return client.$queryRaw<RevokedSession[]>`
        UPDATE sessions SET revoked_at = now(), revoke_reason = ${reason}
        WHERE id = ${target.sessionId}::uuid AND revoked_at IS NULL
        RETURNING id, user_id AS "userId", token_hash AS "tokenHash"`;
    }
    const except = target.exceptSessionId ?? null;
    return client.$queryRaw<RevokedSession[]>`
      UPDATE sessions SET revoked_at = now(), revoke_reason = ${reason}
      WHERE user_id = ${target.userId}::uuid AND revoked_at IS NULL
        AND (${except}::uuid IS NULL OR id <> ${except}::uuid)
      RETURNING id, user_id AS "userId", token_hash AS "tokenHash"`;
  }

  /** Prune-on-write: expired or revoked sessions older than 30 days, at most 500 per call. */
  async prune(): Promise<void> {
    await this.db.client.$executeRaw`DELETE FROM sessions WHERE id IN (
      SELECT id FROM sessions
      WHERE (revoked_at IS NOT NULL OR absolute_expires_at < now() OR idle_expires_at < now())
        AND created_at < now() - interval '30 days'
      LIMIT 500)`;
  }
}
