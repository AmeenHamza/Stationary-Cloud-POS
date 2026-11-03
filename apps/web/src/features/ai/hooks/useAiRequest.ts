'use client';

import { useCallback, useRef, useState } from 'react';

import { userMessageOf } from '@/lib/errors/graphql-error';

import type { AiResultFieldsFragment } from '@/graphql/__generated__/graphql';

export interface AiRequestState {
  result: AiResultFieldsFragment | undefined;
  error: string | undefined;
  loading: boolean;
}

/**
 * State of one AI request (F-29): only the latest request's answer is shown, and a second click
 * while one is running is ignored, so each click is at most one paid call (ADR-026).
 */
export function useAiRequest() {
  const [state, setState] = useState<AiRequestState>({
    result: undefined,
    error: undefined,
    loading: false,
  });
  const running = useRef(false);

  const run = useCallback(
    async (request: () => Promise<AiResultFieldsFragment | undefined>): Promise<void> => {
      if (running.current) {
        return;
      }
      running.current = true;
      setState((previous) => ({ ...previous, error: undefined, loading: true }));
      try {
        const result = await request();
        setState({ result, error: undefined, loading: false });
      } catch (error) {
        setState((previous) => ({ ...previous, error: userMessageOf(error), loading: false }));
      } finally {
        running.current = false;
      }
    },
    [],
  );

  const clear = useCallback(() => {
    setState({ result: undefined, error: undefined, loading: false });
  }, []);

  return { ...state, run, clear };
}
