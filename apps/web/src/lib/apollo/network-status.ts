/**
 * Whether the last HTTP request reached the API (SYSTEM_DESIGN.md §5.8: an HTTP request that failed
 * at network level means offline until the next success). The Apollo links report; the
 * `useOnlineStatus` hook reads. Server and GraphQL errors still count as reachable.
 */
type Listener = () => void;

let reachable = true;
const listeners = new Set<Listener>();

export function reportHttpReachable(next: boolean): void {
  if (next !== reachable) {
    reachable = next;
    listeners.forEach((listener) => {
      listener();
    });
  }
}

export function isHttpReachable(): boolean {
  return reachable;
}

export function onHttpReachabilityChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
