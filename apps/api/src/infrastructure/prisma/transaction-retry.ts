import { isRetryableTransactionError } from '../../common/errors/prisma-error.mapper';
import { jitter, sleep } from '../../common/time/sleep';

export interface RetryPolicy {
  attempts: number;
  minDelayMs: number;
  maxDelayMs: number;
}

/** DATABASE.md §6: up to 3 attempts with a jittered 20–200 ms pause. */
export const DEFAULT_RETRY_POLICY: RetryPolicy = { attempts: 3, minDelayMs: 20, maxDelayMs: 200 };

/**
 * Re-runs a whole transaction after a serialization failure or deadlock. Safe because every
 * financial mutation is idempotent (ADR-015). Other errors propagate immediately.
 */
export async function withTransactionRetry<T>(
  work: () => Promise<T>,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
): Promise<T> {
  let attempt = 1;
  for (;;) {
    try {
      return await work();
    } catch (error) {
      if (attempt >= policy.attempts || !isRetryableTransactionError(error)) {
        throw error;
      }
      attempt += 1;
      await sleep(jitter(policy.minDelayMs, policy.maxDelayMs));
    }
  }
}
