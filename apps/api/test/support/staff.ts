import { expect } from 'vitest';

import { querySql } from '@pos/testkit';

import { errorCode, postGraphql, type GraphqlResponse } from './graphql-client';

/** GraphQL call as a signed-in user (cookie from `loginCookie`). */
export function asUser<T = Record<string, unknown>>(
  baseUrl: string,
  cookie: string,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<GraphqlResponse<T>> {
  return postGraphql<T>(baseUrl, query, { variables, headers: { cookie } });
}

/**
 * Two admins acted against each other at once: exactly one call won and one active admin remains. The
 * loser sees LAST_ADMIN, or UNAUTHENTICATED if the winner's commit already signed them out.
 */
export async function expectOneAdminLeft(
  databaseUrl: string,
  results: readonly GraphqlResponse<unknown>[],
): Promise<void> {
  const codes = results.map((r) => errorCode(r) ?? 'OK');
  expect(codes.filter((code) => code === 'OK')).toHaveLength(1);
  expect(codes.filter((code) => code !== 'OK')).toEqual([
    expect.stringMatching(/^(LAST_ADMIN|UNAUTHENTICATED)$/),
  ]);
  const [row] = await querySql<{ n: string }>(
    databaseUrl,
    "SELECT count(*)::text AS n FROM users WHERE role = 'ADMIN' AND status = 'ACTIVE'",
  );
  expect(row?.n).toBe('1');
}

export const STAFF_FIELDS = 'id username fullName role status version';

export const STAFF_USERS = `query Staff($first: Int, $after: String, $filter: StaffUsersFilter) {
  staffUsers(first: $first, after: $after, filter: $filter) {
    nodes { ${STAFF_FIELDS} } pageInfo { hasNextPage endCursor } totalCount
  }
}`;

export const CREATE_STAFF = `mutation Create($input: CreateStaffUserInput!) {
  createStaffUser(input: $input) { ${STAFF_FIELDS} }
}`;

export const UPDATE_STAFF = `mutation Update($input: UpdateStaffUserInput!) {
  updateStaffUser(input: $input) { ${STAFF_FIELDS} }
}`;

export const SET_STATUS = `mutation Status($input: SetStaffUserStatusInput!) {
  setStaffUserStatus(input: $input) { ${STAFF_FIELDS} }
}`;

export const RESET_PASSWORD = `mutation Reset($input: ResetStaffPasswordInput!) {
  resetStaffPassword(input: $input) { ${STAFF_FIELDS} }
}`;

export interface StaffNode {
  id: string;
  username: string;
  fullName: string;
  role: string;
  status: string;
  version: number;
}
