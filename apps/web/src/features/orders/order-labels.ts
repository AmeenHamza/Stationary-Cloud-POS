import { formatRs } from '@pos/domain';

import type { OrderRowFieldsFragment } from '@/graphql/__generated__/graphql';
import type { OrderStatus } from '@pos/contracts';

export const ORDER_STATUS_LABEL: Readonly<Record<OrderStatus, string>> = {
  COMPLETED: 'Completed',
  PARTIALLY_REFUNDED: 'Partly refunded',
  REFUNDED: 'Refunded',
};

/** "−Rs 400.00 (Flat)" or "−Rs 24.00 (10%)" as the old order history showed it; "—" for none. */
export function discountLabel(
  order: Pick<OrderRowFieldsFragment, 'discountType' | 'discountValue' | 'discountTotal'>,
): string {
  if (order.discountType === 'NONE') {
    return '—';
  }
  const kind = order.discountType === 'FLAT' ? 'Flat' : `${order.discountValue}%`;
  return `−${formatRs(order.discountTotal)} (${kind})`;
}
