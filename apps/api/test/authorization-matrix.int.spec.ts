import { GraphQLSchemaHost } from '@nestjs/graphql';
import { describe, expect, it } from 'vitest';

import { hasPermission, USER_ROLES, type UserRole } from '@pos/contracts';

import { errorCode, postGraphql } from './support/graphql-client';
import { minimalOperation, operationPolicies, schemaOperations } from './support/operation-matrix';
import { useRoles } from './support/roles';

import type { AccessPolicy } from '../src/common/auth/access-policy';

const t = useRoles();

type Caller = 'anonymous' | UserRole;
const REFUSED = new Set(['UNAUTHENTICATED', 'FORBIDDEN']);

/** What the guard must answer, or null when the call must get past it (API.md §5). */
function expectedRefusal(policy: AccessPolicy, caller: Caller): string | null {
  if (policy.kind === 'public') {
    return null;
  }
  if (caller === 'anonymous') {
    return 'UNAUTHENTICATED';
  }
  return policy.kind === 'permission' && !hasPermission(caller, policy.permission)
    ? 'FORBIDDEN'
    : null;
}

/** `logout` would end the caller's session mid-matrix; its refusal is still checked for anonymous. */
const SKIP_ALLOWED = new Set(['Mutation.logout']);

/** A resolver's own answer that shares a guard code: login's generic credential error (SEC-04). */
const OWN_ANSWERS: Readonly<Record<string, string>> = {
  'Mutation.login': 'Invalid username or password.',
  'Mutation.signUp': 'Invalid signup secret.',
};

describe('SEC-02: every operation × {anonymous, cashier, admin} (API.md §5)', () => {
  it('refuses exactly the callers the access policy excludes, before any argument checks', async () => {
    const schema = t.h.app.get(GraphQLSchemaHost).schema;
    const policies = operationPolicies(t.h.app);
    const cookies: Record<Caller, string | undefined> = {
      anonymous: undefined,
      CASHIER: t.cashier,
      ADMIN: t.admin,
    };
    const mismatches: string[] = [];
    const operations = schemaOperations(schema);
    expect(operations.length).toBeGreaterThan(40);
    for (const { operation, key, field } of operations) {
      const policy = policies.get(key);
      if (policy === undefined) {
        mismatches.push(`${key}: no access policy found`);
        continue;
      }
      for (const caller of ['anonymous', ...USER_ROLES] as const) {
        const refusal = expectedRefusal(policy, caller);
        if (refusal === null && SKIP_ALLOWED.has(key)) {
          continue;
        }
        const { query, variables } = minimalOperation(operation, field);
        const cookie = cookies[caller];
        const response = await postGraphql(t.h.url, query, {
          variables,
          headers: cookie === undefined ? {} : { cookie },
        });
        const raw = errorCode(response);
        const code = typeof raw === 'string' ? raw : 'none';
        const own = OWN_ANSWERS[key] === response.body.errors?.[0]?.message;
        const ok = refusal === null ? own || !REFUSED.has(code) : code === refusal;
        if (!ok) {
          mismatches.push(`${key} as ${caller}: expected ${refusal ?? 'allowed'}, got ${code}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('limits administrative account creation while signup requires its own secret', () => {
    const policies = operationPolicies(t.h.app);
    const accountCreators = [...policies.keys()].filter((key) =>
      /^Mutation\.(sign.?up|register|create.*user|create.*account)/i.test(key),
    );
    expect(accountCreators.sort()).toEqual(['Mutation.createStaffUser', 'Mutation.signUp']);
    expect(policies.get('Mutation.signUp')).toEqual({ kind: 'public' });
    expect(policies.get('Mutation.createStaffUser')).toEqual({
      kind: 'permission',
      permission: 'staff:manage',
    });
  });

  it('gives a foreign origin no CORS permission (SEC-07)', async () => {
    const preflight = (origin: string) =>
      fetch(`${t.h.url}/graphql`, {
        method: 'OPTIONS',
        headers: { origin, 'access-control-request-method': 'POST' },
      });
    const foreign = await preflight('https://evil.example');
    expect(foreign.headers.get('access-control-allow-origin')).toBeNull();
    const own = await preflight('http://localhost:3000');
    expect(own.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
  });
});
