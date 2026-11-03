import { SetMetadata } from '@nestjs/common';

import type { Permission } from '@pos/contracts';

/**
 * How a resolver or controller method may be reached (API.md §5). Every handler has exactly one;
 * `AccessGuard` refuses handlers without a policy (fail closed, SEC-01).
 */
export type AccessPolicy =
  { kind: 'public' } | { kind: 'authenticated' } | { kind: 'permission'; permission: Permission };

export const ACCESS_POLICY = 'pos:access-policy';

/** Reachable without a session: login, serverInfo, health. */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(ACCESS_POLICY, { kind: 'public' } satisfies AccessPolicy);

/** Any signed-in user: me, logout, changePassword. */
export const Authenticated = (): MethodDecorator & ClassDecorator =>
  SetMetadata(ACCESS_POLICY, { kind: 'authenticated' } satisfies AccessPolicy);

/** A signed-in user whose role grants `permission` (ROLE_PERMISSIONS in @pos/contracts). */
export const RequirePermission = (permission: Permission): MethodDecorator & ClassDecorator =>
  SetMetadata(ACCESS_POLICY, { kind: 'permission', permission } satisfies AccessPolicy);
