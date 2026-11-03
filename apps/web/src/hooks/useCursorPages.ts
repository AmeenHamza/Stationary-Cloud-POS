'use client';

import { useCallback, useState } from 'react';

/**
 * Forward/back paging over a keyset connection (API.md §3): keeps the cursors of the pages already
 * visited, so "Previous" reuses the cached page instead of re-reading from the start.
 */
export type CursorPages = ReturnType<typeof useCursorPages>;

export function useCursorPages() {
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const after = cursors.at(-1) ?? null;

  const next = useCallback((endCursor: string | null) => {
    if (endCursor !== null) {
      setCursors((previous) => [...previous, endCursor]);
    }
  }, []);

  const previous = useCallback(() => {
    setCursors((current) => (current.length > 1 ? current.slice(0, -1) : current));
  }, []);

  const reset = useCallback(() => {
    setCursors([null]);
  }, []);

  return { after, page: cursors.length, hasPrevious: cursors.length > 1, next, previous, reset };
}
