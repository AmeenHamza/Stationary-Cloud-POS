import type { UserRole } from '@pos/contracts';
import type { IncomingMessage } from 'node:http';

/** The signed-in user of a request (SYSTEM_DESIGN.md §2.2). Permissions derive from `role`. */
export interface Principal {
  sessionId: string;
  userId: string;
  role: UserRole;
}

/** A request as the resolver sees it: parsed cookies plus the raw headers. */
export type SessionRequest = IncomingMessage & { cookies?: Record<string, string | undefined> };

/**
 * Implemented by the auth module and provided under PRINCIPAL_RESOLVER, so `common` never imports a
 * module (dependency rule `api-core-no-modules`). Returns null for a missing or invalid session.
 */
export interface PrincipalResolver {
  resolve: (request: SessionRequest) => Promise<Principal | null>;
}

export const PRINCIPAL_RESOLVER = Symbol('PRINCIPAL_RESOLVER');

const principals = new WeakMap<object, Principal>();

export function attachPrincipal(request: object, principal: Principal): void {
  principals.set(request, principal);
}

export function principalOf(request: object): Principal | undefined {
  return principals.get(request);
}
