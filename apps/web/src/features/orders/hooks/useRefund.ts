'use client';

import { useMutation, useQuery } from '@apollo/client/react';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  calculateRefund,
  formatRs,
  refundAllRequest,
  refundSnapshotOf,
  toMoneyString,
  type Decimal,
  type RefundOrderSnapshot,
  type RefundRequestLine,
} from '@pos/domain';

import { errorCodeOf, userMessageOf } from '@/lib/errors/graphql-error';
import { newIdempotencyKey } from '@/lib/ids/idempotency-key';
import { applyOrderRefunded } from '@/lib/realtime/handlers/order-refunded';

import { OrderDetailDocument, RefundOrderDocument } from '../graphql/orders.documents';

/** The amount a request would refund, or null when it refunds nothing (A-06, shared maths). */
function quote(snapshot: RefundOrderSnapshot | null, request: RefundRequestLine[]): Decimal | null {
  if (snapshot === null || request.length === 0) {
    return null;
  }
  try {
    return calculateRefund(snapshot, request).amount;
  } catch {
    return null;
  }
}

/** Chosen quantities per bill line; "Select all remaining" picks what each line has left. */
function useRefundSelection(snapshot: RefundOrderSnapshot | null) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const selected = Object.entries(quantities)
    .filter(([, quantity]) => quantity > 0)
    .map(([lineId, quantity]) => ({ lineId, quantity }));
  const allRequest = snapshot === null ? [] : refundAllRequest(snapshot);
  return {
    quantities,
    selected,
    allRequest,
    setQuantity: (lineId: string, quantity: number) => {
      setQuantities((current) => ({ ...current, [lineId]: quantity }));
    },
    selectAll: () => {
      setQuantities(Object.fromEntries(allRequest.map((l) => [l.lineId, l.quantity])));
    },
    clear: () => {
      setQuantities({});
    },
  };
}

/**
 * Refund state for one bill (F-16, `#17`): fresh lines from the server, chosen quantities, and the
 * amounts priced with the API's own refund function, sent as `expectedAmount`. A retry of the same
 * request keeps its idempotency key, so a lost response never refunds twice.
 */
export function useRefund(orderId: string, onDone: () => void) {
  const { data, refetch } = useQuery(OrderDetailDocument, {
    variables: { id: orderId },
    fetchPolicy: 'network-only',
  });
  const [mutate, { loading }] = useMutation(RefundOrderDocument);
  const [reason, setReason] = useState('');
  const attempt = useRef<{ request: string; key: string } | null>(null);
  const order = data?.order ?? null;
  const snapshot = useMemo(() => (order === null ? null : refundSnapshotOf(order)), [order]);
  const selection = useRefundSelection(snapshot);
  const { selected, allRequest } = selection;

  const submit = async (all: boolean) => {
    const amount = quote(snapshot, all ? allRequest : selected);
    if (amount === null) {
      return;
    }
    const input = {
      orderId,
      ...(all
        ? { refundAll: true }
        : { lines: selected.map((l) => ({ orderLineId: l.lineId, quantity: l.quantity })) }),
      reason: reason.trim() === '' ? null : reason.trim(),
      expectedAmount: toMoneyString(amount),
    };
    const request = JSON.stringify(input);
    const key = attempt.current?.request === request ? attempt.current.key : newIdempotencyKey();
    attempt.current = { request, key };
    try {
      const result = await mutate({
        variables: { input: { ...input, idempotencyKey: key } },
        update: (cache, { data: refunded }) => {
          const changed = refunded?.refundOrder.order;
          if (changed !== undefined) {
            applyOrderRefunded(cache, { ...changed, orderId: changed.id });
          }
        },
      });
      attempt.current = null;
      const toKhata = result.data?.refundOrder.refund.settlement === 'KHATA_CREDIT';
      toast.success(`Refunded ${formatRs(amount)}${toKhata ? ' to the customer khata' : ''}.`);
      selection.clear();
      onDone();
    } catch (error) {
      const code = errorCodeOf(error);
      if (code !== null) {
        attempt.current = null; // the server answered: nothing was refunded
      }
      if (code === 'QUOTE_MISMATCH' || code === 'REFUND_EXCEEDS_REMAINING') {
        selection.clear();
        await refetch();
        toast.error(
          'This bill changed (another counter may have refunded it). Check and try again.',
        );
        return;
      }
      toast.error(userMessageOf(error));
    }
  };

  return {
    ...selection,
    order,
    selectedAmount: quote(snapshot, selected),
    allAmount: quote(snapshot, allRequest),
    reason,
    setReason,
    loading,
    submit,
  };
}
