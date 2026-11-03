/** Close codes that must not be retried: the session ended (4401) or the origin is wrong (4403). */
export const NO_RETRY_CLOSE_CODES: ReadonlySet<number> = new Set([4401, 4403]);

const MIN_DELAY_MS = 500;
const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;

/**
 * Reconnect delay with full jitter (SYSTEM_DESIGN.md §5.5): a random value between 500 ms and
 * min(30 s, 1 s × 2^attempt), so many tabs reconnecting after an outage spread out.
 */
export function retryDelay(attempt: number, random: () => number = Math.random): number {
  const ceiling = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt);
  const upper = Math.max(MIN_DELAY_MS, ceiling);
  return MIN_DELAY_MS + random() * (upper - MIN_DELAY_MS);
}

/** graphql-ws `shouldRetry`: retry everything except a closed session or a refused origin. */
export function shouldRetry(closeEvent: unknown): boolean {
  const code = (closeEvent as { code?: unknown } | null)?.code;
  return typeof code !== 'number' || !NO_RETRY_CLOSE_CODES.has(code);
}
