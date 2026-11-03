import { OrderRefundStateFragment } from '@/graphql/fragments/order.fragments';

import { entityId, isNewer } from './versions';

import type { OrderRefundStateFragment as OrderRefundState } from '@/graphql/__generated__/graphql';
import type { ApolloCache } from '@apollo/client';

/**
 * `order.refunded`, or a refund this tab just made: patch the cached bill's status and refunded
 * total when newer, so open order lists update in place (nothing is fetched for unseen bills).
 */
export function applyOrderRefunded(
  cache: ApolloCache,
  change: {
    orderId: string;
    status: OrderRefundState['status'];
    refundedTotal: string;
    version: number;
  },
): void {
  const { orderId, status, refundedTotal, version } = change;
  if (!isNewer(cache, 'Order', orderId, version)) {
    return;
  }
  const data: OrderRefundState & { __typename: 'Order' } = {
    __typename: 'Order',
    id: orderId,
    status,
    refundedTotal,
    version,
  };
  cache.writeFragment({
    id: entityId(cache, 'Order', orderId),
    fragment: OrderRefundStateFragment,
    data,
  });
}
