interface WindowEntry {
  count: number;
  resetAt: number;
}

/**
 * In-process fixed-window counter used for auth buckets while Redis is down (API.md §8). Bounded:
 * expired entries are dropped, and the map never grows beyond `maxEntries`.
 */
export class MemoryWindow {
  private readonly entries = new Map<string, WindowEntry>();

  constructor(private readonly maxEntries = 10_000) {}

  hit(key: string, windowMs: number, now: number): { count: number; resetInMs: number } {
    let entry = this.entries.get(key);
    if (entry === undefined || entry.resetAt <= now) {
      this.makeRoom(now);
      entry = { count: 0, resetAt: now + windowMs };
      this.entries.set(key, entry);
    }
    entry.count += 1;
    return { count: entry.count, resetInMs: entry.resetAt - now };
  }

  get size(): number {
    return this.entries.size;
  }

  private makeRoom(now: number): void {
    if (this.entries.size < this.maxEntries) {
      return;
    }
    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= now) {
        this.entries.delete(key);
      }
    }
    // Still full: drop the oldest insertion (Map preserves insertion order).
    const oldest = this.entries.keys().next();
    if (this.entries.size >= this.maxEntries && oldest.done !== true) {
      this.entries.delete(oldest.value);
    }
  }
}
