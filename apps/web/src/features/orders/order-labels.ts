import { formatRs } from '@pos/domain';

import type { OrderRowFieldsFragment } from '@/graphql/__generated__/graphql';
import type { OrderStatus } from '@pos/contracts';

export const ORDER_STATUS_LABEL: Readonly<Record<OrderStatus, string>> = {
  COMPLETED: 'Completed',
  PARTIALLY_REFUNDED: 'Partly refunded',
  REFUNDED: 'Refunded',
};

/**
 * "−Rs 400.00 (Flat)" or "−Rs 24.00 (10%)" as the old order history showed it, "−Rs 50.00 (Items)"
 * or "−Rs 90.00 (10% + items)" with item discounts (D-27); "—" for none.
 */
export function discountLabel(
  order: Pick<
    OrderRowFieldsFragment,
    'discountType' | 'discountValue' | 'discountTotal' | 'itemDiscountTotal'
  >,
): string {
  const onItems = order.itemDiscountTotal !== '0.00';
  if (order.discountType === 'NONE') {
    return onItems ? `−${formatRs(order.discountTotal)} (Items)` : '—';
  }
  const kind = order.discountType === 'FLAT' ? 'Flat' : `${order.discountValue}%`;
  return `−${formatRs(order.discountTotal)} (${kind}${onItems ? ' + items' : ''})`;
}
