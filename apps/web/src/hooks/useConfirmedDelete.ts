'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { userMessageOf } from '@/lib/errors/graphql-error';

export interface ConfirmedDelete<T> {
  target: T | null;
  ask: (target: T) => void;
  cancel: () => void;
  confirm: () => Promise<void>;
  busy: boolean;
  /** "Delete Ball pen?", empty while nothing is being asked about. */
  title: string;
}

/**
 * A delete that asks first (D-28), for `<DeleteConfirm>`. The server decides whether the row may go:
 * a refusal such as HAS_HISTORY is shown as its message, and nothing is removed.
 */
export function useConfirmedDelete<T>(options: {
  nameOf: (target: T) => string;
  remove: (target: T) => Promise<unknown>;
}): ConfirmedDelete<T> {
  const [target, setTarget] = useState<T | null>(null);
  const [busy, setBusy] = useState(false);
  const confirm = async (): Promise<void> => {
    if (target === null) {
      return;
    }
    setBusy(true);
    try {
      await options.remove(target);
      toast.success(`${options.nameOf(target)} deleted.`);
    } catch (error) {
      toast.error(userMessageOf(error));
    } finally {
      setBusy(false);
      setTarget(null);
    }
  };
  return {
    target,
    ask: setTarget,
    cancel: () => {
      setTarget(null);
    },
    confirm,
    busy,
    title: target === null ? '' : `Delete ${options.nameOf(target)}?`,
  };
}
