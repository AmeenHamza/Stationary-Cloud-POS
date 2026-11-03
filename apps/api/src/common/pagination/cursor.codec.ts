import { AppError } from '../errors/app-error';

/** Sort key value carried in a cursor: a string (names, decimals as text, ISO dates) or number. */
export type CursorKey = string | number;

interface CursorPayload {
  v: 1;
  s: string;
  k: [CursorKey, string];
}

/**
 * Opaque keyset cursor (API.md §3): base64url of `{ v: 1, s: <sort>, k: [<sortValue>, <id>] }`.
 * Binding the sort into the cursor makes a cursor from another sort order invalid.
 */
export function encodeCursor(sort: string, key: CursorKey, id: string): string {
  const payload: CursorPayload = { v: 1, s: sort, k: [key, id] };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function isPayload(value: unknown): value is CursorPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  const keys = candidate['k'];
  return (
    candidate['v'] === 1 &&
    typeof candidate['s'] === 'string' &&
    Array.isArray(keys) &&
    keys.length === 2 &&
    (typeof keys[0] === 'string' || typeof keys[0] === 'number') &&
    typeof keys[1] === 'string'
  );
}

/** Decodes a cursor for `sort`; anything malformed or from another sort is BAD_CURSOR. */
export function decodeCursor(cursor: string, sort: string): { key: CursorKey; id: string } {
  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    payload = null;
  }
  if (!isPayload(payload) || payload.s !== sort) {
    throw new AppError(
      'BAD_CURSOR',
      'This page link is no longer valid. Start from the first page.',
    );
  }
  return { key: payload.k[0], id: payload.k[1] };
}
