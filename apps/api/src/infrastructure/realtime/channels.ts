import { REDIS_NAMESPACE } from '../cache/cache-keys';

/** Who receives an event (API.md §7.1): all staff, admins only, or one user. */
export type Audience = 'staff' | 'admin' | `user:${string}`;

const USER_AUDIENCE = /^user:[0-9a-f-]{36}$/;

export function userAudience(userId: string): Audience {
  return `user:${userId}`;
}

export function isAudience(value: string): value is Audience {
  return value === 'staff' || value === 'admin' || USER_AUDIENCE.test(value);
}

/** Redis channel carrying one audience's events (SYSTEM_DESIGN.md §6.2). */
export function channelFor(audience: Audience): string {
  return `${REDIS_NAMESPACE}:ev:${audience}`;
}
