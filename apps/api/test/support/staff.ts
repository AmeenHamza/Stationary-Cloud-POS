import { postGraphql, type GraphqlResponse } from './graphql-client';

/** GraphQL call as a signed-in user (cookie from `loginCookie`). */
export function asUser<T = Record<string, unknown>>(
  baseUrl: string,
  cookie: string,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<GraphqlResponse<T>> {
  return postGraphql<T>(baseUrl, query, { variables, headers: { cookie } });
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
