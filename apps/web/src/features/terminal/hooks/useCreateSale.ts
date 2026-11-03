'use client';

import { useApolloClient } from '@apollo/client/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useViewer } from '@/features/auth';
import { userMessageOf } from '@/lib/errors/graphql-error';

import { useCart } from '../state/CartProvider';
import { clearPendingSale, loadPendingSale, savePendingSale } from '../state/pending-sale.storage';

import { explainSaleError } from './sale-errors';
import { confirmSale, sendSale, type CompletedSale } from './sale-sender';

import type { CreateSaleInput } from '@/graphql/__generated__/graphql';

export type SaleStatus = 'idle' | 'sending' | 'confirming' | 'unknown' | 'checking' | 'notRecorded';

/** The saved, not yet confirmed sale and its status; `start` saves before sending. */
function usePendingSale(userId: string) {
  const [pending, setPending] = useState(() => loadPendingSale(userId));
  const [status, setStatus] = useState<SaleStatus>(pending === null ? 'idle' : 'checking');
  const settle = useCallback(() => {
    clearPendingSale(userId);
    setPending(null);
    setStatus('idle');
  }, [userId]);
  const start = (input: CreateSaleInput) => {
    savePendingSale(userId, input);
    setPending(input);
    setStatus('sending');
  };
  return { pending, status, setStatus, settle, start };
}

/**
 * The sale lifecycle at the counter (SYSTEM_DESIGN.md §3.3–§3.4): the input and its key are saved
 * before sending and kept until the server confirms or refuses; the cart is cleared only after a
 * confirmed sale; a reload with a saved sale asks `saleStatus` once instead of guessing.
 */
export function useCreateSale() {
  const { id: userId } = useViewer();
  const { dispatch } = useCart();
  const client = useApolloClient();
  const { pending, status, setStatus, settle, start } = usePendingSale(userId);
  const [completed, setCompleted] = useState<CompletedSale | null>(null);
  const checkOnMount = useRef(pending !== null);

  const finish = useCallback(
    (sale: CompletedSale) => {
      settle();
      dispatch({ type: 'clear' });
      setCompleted(sale);
    },
    [settle, dispatch],
  );

  const send = useCallback(
    async (input: CreateSaleInput) => {
      const outcome = await sendSale(client, input, () => {
        setStatus('confirming');
      });
      if (outcome.kind === 'done') {
        finish(outcome.sale);
      } else if (outcome.kind === 'refused') {
        settle();
        explainSaleError(outcome.error, {
          refreshPrices: () => void client.refetchQueries({ include: ['CartProducts'] }),
          removeProducts: (productIds) => {
            dispatch({ type: 'removeProducts', productIds });
          },
        });
      } else {
        setStatus('unknown');
      }
    },
    [client, dispatch, finish, settle, setStatus],
  );

  const check = useCallback(async () => {
    if (pending === null) {
      return;
    }
    setStatus('checking');
    try {
      const sale = await confirmSale(client, pending.idempotencyKey);
      if (sale === null) {
        setStatus('notRecorded');
      } else {
        finish(sale);
      }
    } catch (error) {
      setStatus('unknown');
      toast.error(userMessageOf(error));
    }
  }, [client, finish, pending, setStatus]);

  useEffect(() => {
    if (checkOnMount.current) {
      checkOnMount.current = false;
      void check();
    }
  });

  return {
    status,
    pending,
    completed,
    submit: (input: CreateSaleInput) => {
      start(input);
      void send(input);
    },
    check,
    retry: () => {
      if (pending !== null) {
        setStatus('sending');
        void send(pending);
      }
    },
    discard: settle,
    dismiss: () => {
      setCompleted(null);
    },
  };
}

export type SaleFlow = ReturnType<typeof useCreateSale>;
