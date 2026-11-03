import { createHash, randomBytes } from 'node:crypto';

/** SHA-256 digest as Prisma's `Bytes` type expects it (a plain ArrayBuffer-backed Uint8Array). */
export type TokenHash = Uint8Array<ArrayBuffer>;

/** A new opaque session token (sent only in the cookie) and the hash stored in `sessions.token_hash`. */
export function newSessionToken(): { token: string; tokenHash: TokenHash } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashSessionToken(token) };
}

export function hashSessionToken(token: string): TokenHash {
  return new Uint8Array(createHash('sha256').update(token).digest());
}

/** Hex form used in the session cache key. */
export function tokenHashHex(tokenHash: Uint8Array): string {
  return Buffer.from(tokenHash).toString('hex');
}
