import { createHash } from 'node:crypto';

/** JSON with object keys sorted at every level, so equal inputs always serialize identically. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`);
    return `{${entries.join(',')}}`;
  }
  // JSON.stringify(undefined) yields undefined at runtime; an absent value hashes like null.
  return value === undefined ? 'null' : JSON.stringify(value);
}

/**
 * SHA-256 of a mutation input without its idempotency key (ADR-015, DATABASE.md §7): the same key
 * with a different payload is detected as IDEMPOTENCY_KEY_REUSED.
 */
export function requestHash(input: Readonly<Record<string, unknown>>): Buffer {
  const rest = Object.fromEntries(
    Object.entries(input).filter(([key]) => key !== 'idempotencyKey'),
  );
  return createHash('sha256').update(canonicalJson(rest)).digest();
}

/** The same hash as Prisma's `Bytes` type expects it (stored in `request_hash` columns). */
export function requestHashBytes(
  input: Readonly<Record<string, unknown>>,
): Uint8Array<ArrayBuffer> {
  return new Uint8Array(requestHash(input));
}
