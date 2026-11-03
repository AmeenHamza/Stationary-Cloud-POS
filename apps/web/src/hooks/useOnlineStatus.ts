'use client';

import { useSyncExternalStore } from 'react';

import { isHttpReachable, onHttpReachabilityChange } from '@/lib/apollo/network-status';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  const stopHttp = onHttpReachabilityChange(onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
    stopHttp();
  };
}

/**
 * False when the browser reports no network or the last API request failed at network level
 * (SYSTEM_DESIGN.md §5.8). Billing is disabled while this is false (D-05).
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine && isHttpReachable(),
    () => true,
  );
}
