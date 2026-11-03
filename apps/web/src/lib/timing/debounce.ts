/**
 * Runs each key's latest task at most once per window (trailing edge): the first call for a key
 * starts the window, later calls inside it only replace the task. Realtime handlers use it so a burst
 * of events becomes one refetch (SYSTEM_DESIGN.md §5.4: at most one per 1.5 s per key). Never a
 * timer loop: nothing runs unless an event arrived.
 */
export interface Coalescer {
  schedule: (key: string, task: () => void) => void;
  cancelAll: () => void;
}

export function createCoalescer(windowMs: number): Coalescer {
  const pending = new Map<string, { timer: ReturnType<typeof setTimeout>; task: () => void }>();
  return {
    schedule(key, task) {
      const entry = pending.get(key);
      if (entry !== undefined) {
        entry.task = task;
        return;
      }
      const timer = setTimeout(() => {
        const current = pending.get(key);
        pending.delete(key);
        current?.task();
      }, windowMs);
      pending.set(key, { timer, task });
    },
    cancelAll() {
      for (const { timer } of pending.values()) {
        clearTimeout(timer);
      }
      pending.clear();
    },
  };
}
