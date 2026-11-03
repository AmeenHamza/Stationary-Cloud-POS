/** Resolves after `milliseconds`. One of the two web files allowed to use timers (CODING_STANDARDS.md §6). */
export function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
