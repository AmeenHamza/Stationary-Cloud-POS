/**
 * The API's only timer (CODING_STANDARDS.md §6): a one-shot delay used by retry backoff.
 * It never schedules repeated work and never fetches data.
 */
export function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

/** Random delay in [min, max] milliseconds, for jittered retries. */
export function jitter(minimum: number, maximum: number): number {
  return minimum + Math.random() * (maximum - minimum);
}
