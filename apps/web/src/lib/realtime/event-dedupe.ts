/**
 * Remembers the last `capacity` event sequence numbers so an event delivered twice (outbox replay
 * after a crash, RT-04) is applied once. Insertion-ordered Set used as an LRU.
 */
export function createEventDedupe(capacity = 1_000): (seq: string) => boolean {
  const seen = new Set<string>();
  return (seq) => {
    if (seen.has(seq)) {
      return true;
    }
    seen.add(seq);
    if (seen.size > capacity) {
      const oldest = seen.values().next();
      if (oldest.done !== true) {
        seen.delete(oldest.value);
      }
    }
    return false;
  };
}
