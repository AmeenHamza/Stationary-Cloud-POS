import { Inject, Injectable } from '@nestjs/common';

import { USER_ROLES, type UserRole } from '@pos/contracts';

import { ClockService } from '../../../common/time/clock.service';
import { APP_CONFIG, type AppConfig } from '../../../config/app-config';
import { CacheKeys } from '../../../infrastructure/cache/cache-keys';
import { CacheService } from '../../../infrastructure/cache/cache.service';
import { SessionsRepository } from '../persistence/sessions.repository';
import { readSessionToken } from '../session-cookie';

import { hashSessionToken, newSessionToken, tokenHashHex, type TokenHash } from './session-token';

import type { Principal, PrincipalResolver, SessionRequest } from '../../../common/auth/principal';
import type { ClientInfo } from '../../../common/http/request-context';

const HOUR = 3_600_000;
const TOUCH_AFTER_MS = 15 * 60_000;
export const SESSION_CACHE_TTL_SECONDS = 300;
export const REVOKED_MARKER = 'REVOKED';

interface CachedPrincipal extends Principal {
  expiresAt: number;
}

function decodeCached(raw: string | null): CachedPrincipal | null {
  if (raw === null || raw === REVOKED_MARKER) {
    return null;
  }
  try {
    const { sessionId, userId, role, expiresAt } = JSON.parse(raw) as Record<string, unknown>;
    return typeof sessionId === 'string' &&
      typeof userId === 'string' &&
      typeof expiresAt === 'number' &&
      isUserRole(role)
      ? { sessionId, userId, role, expiresAt }
      : null;
  } catch {
    return null;
  }
}

function isUserRole(value: unknown): value is UserRole {
  return (USER_ROLES as readonly unknown[]).includes(value);
}

/**
 * Server-side sessions (ADR-011, SYSTEM_DESIGN.md §2.2): creation on login and resolution on every
 * request. Redis holds a 300 s principal cache and revocation tombstones; PostgreSQL decides.
 */
@Injectable()
export class SessionService implements PrincipalResolver {
  constructor(
    private readonly sessions: SessionsRepository,
    private readonly cache: CacheService,
    private readonly clock: ClockService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Inside the login transaction. Returns the cookie token and when it expires. */
  async create(userId: string, client: ClientInfo): Promise<{ token: string; expiresAt: Date }> {
    const now = this.clock.now();
    const absoluteExpiresAt = new Date(
      now.getTime() + this.config.SESSION_ABSOLUTE_DAYS * 24 * HOUR,
    );
    const { token, tokenHash } = newSessionToken();
    await this.sessions.insert({
      userId,
      tokenHash,
      idleExpiresAt: this.idleExpiry(now, absoluteExpiresAt),
      absoluteExpiresAt,
      ip: client.ip,
      userAgent: client.userAgent,
    });
    await this.sessions.prune();
    return { token, expiresAt: absoluteExpiresAt };
  }

  async resolve(request: SessionRequest): Promise<Principal | null> {
    const token = readSessionToken(request);
    if (token === null) {
      return null;
    }
    const tokenHash = hashSessionToken(token);
    const key = CacheKeys.session(tokenHashHex(tokenHash));
    const raw = await this.cache.getRaw(key);
    if (raw === REVOKED_MARKER) {
      return null;
    }
    const now = this.clock.now();
    const cached = decodeCached(raw);
    if (cached !== null && now.getTime() < cached.expiresAt) {
      return { sessionId: cached.sessionId, userId: cached.userId, role: cached.role };
    }
    return this.loadFromDatabase(tokenHash, key, now);
  }

  private async loadFromDatabase(
    tokenHash: TokenHash,
    key: string,
    now: Date,
  ): Promise<Principal | null> {
    const session = await this.sessions.findActive(tokenHash, now);
    if (session === null) {
      return null;
    }
    let idleExpiresAt = session.idleExpiresAt;
    if (now.getTime() - session.lastSeenAt.getTime() > TOUCH_AFTER_MS) {
      idleExpiresAt = this.idleExpiry(now, session.absoluteExpiresAt);
      await this.sessions.touch(session.id, now, idleExpiresAt);
    }
    const principal: Principal = {
      sessionId: session.id,
      userId: session.userId,
      role: session.role,
    };
    const expiresAt = Math.min(idleExpiresAt.getTime(), session.absoluteExpiresAt.getTime());
    // NX: a fill racing a revocation can never overwrite the tombstone (SYSTEM_DESIGN.md §2.2).
    await this.cache.setRaw(
      key,
      JSON.stringify({ ...principal, expiresAt }),
      SESSION_CACHE_TTL_SECONDS,
      true,
    );
    return principal;
  }

  private idleExpiry(now: Date, absoluteExpiresAt: Date): Date {
    const idle = now.getTime() + this.config.SESSION_IDLE_HOURS * HOUR;
    return new Date(Math.min(idle, absoluteExpiresAt.getTime()));
  }
}
