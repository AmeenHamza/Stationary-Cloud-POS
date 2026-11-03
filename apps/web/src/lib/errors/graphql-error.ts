import { CombinedGraphQLErrors } from '@apollo/client/errors';

import type { ErrorCode } from '@pos/contracts';

/** The first GraphQL error code of an Apollo error (API.md §4), or null for network failures. */
export function errorCodeOf(error: unknown): ErrorCode | null {
  if (!CombinedGraphQLErrors.is(error)) {
    return null;
  }
  const code = error.errors[0]?.extensions?.['code'];
  return typeof code === 'string' ? (code as ErrorCode) : null;
}

/** Field messages from a BAD_USER_INPUT error, keyed by input path (e.g. `newPassword`). */
export function fieldErrorsOf(error: unknown): Record<string, string> {
  if (!CombinedGraphQLErrors.is(error)) {
    return {};
  }
  const fieldErrors = error.errors[0]?.extensions?.['fieldErrors'];
  if (typeof fieldErrors !== 'object' || fieldErrors === null) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(fieldErrors).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

/** The server's message for known errors; a generic one otherwise (never raw network details). */
export function userMessageOf(error: unknown): string {
  if (CombinedGraphQLErrors.is(error)) {
    return error.errors[0]?.message ?? 'Something went wrong.';
  }
  return 'Cannot reach the server. Check the connection and try again.';
}
