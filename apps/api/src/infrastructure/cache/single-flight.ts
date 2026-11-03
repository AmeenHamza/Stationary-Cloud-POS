/**
 * Collapses concurrent loads of the same key on one instance into a single call, which prevents
 * cache stampedes when a popular key expires (SYSTEM_DESIGN.md §6.3).
 */
export class SingleFlight {
  private readonly inFlight = new Map<string, Promise<unknown>>();

  run<T>(key: string, work: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key);
    if (existing !== undefined) {
      return existing as Promise<T>;
    }
    const pending = work().finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, pending);
    return pending;
  }

  get size(): number {
    return this.inFlight.size;
  }
}
