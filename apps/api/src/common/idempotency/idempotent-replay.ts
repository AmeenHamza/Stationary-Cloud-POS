import { AppError } from '../errors/app-error';
import { isUniqueViolation } from '../errors/prisma-error.mapper';

export interface IdempotentCall<T> {
  /** Column of the unique idempotency key; driver errors name the column (`idempotency_key`). */
  keyColumn: string;
  /** SHA-256 of the request without its key (`requestHash`). */
  requestHash: Uint8Array;
  /** The use case; it stores the key and hash with its first write. */
  execute: () => Promise<T>;
  /** The stored request hash and result for this key, after a duplicate was detected. */
  replay: () => Promise<{ requestHash: Uint8Array; result: T } | null>;
}

/**
 * Retry-safe mutations (ADR-015, DATABASE.md §7): run once; when the key's unique index reports a
 * duplicate (a retry, or the same action twice), the transaction has rolled back, so the stored
 * result is returned if the payload matches, and IDEMPOTENCY_KEY_REUSED if it does not.
 */
export async function runIdempotent<T>(call: IdempotentCall<T>): Promise<T> {
  try {
    return await call.execute();
  } catch (error) {
    if (!isUniqueViolation(error, call.keyColumn)) {
      throw error;
    }
    const stored = await call.replay();
    if (stored === null) {
      throw error;
    }
    if (!Buffer.from(stored.requestHash).equals(Buffer.from(call.requestHash))) {
      throw new AppError(
        'IDEMPOTENCY_KEY_REUSED',
        'This action was already submitted with different details. Start it again.',
      );
    }
    return stored.result;
  }
}
