import { money } from '../money/money.js';

import type { RefundOrderSnapshot } from './refund.types.js';

/** A sold line as stored and served (API `OrderLine`): money as two-decimal strings. */
export interface StoredRefundLine {
  id: string;
  quantity: number;
  refundedQuantity: number;
  lineNet: string;
  lineTax: string;
  refundedAmount: string;
}

/**
 * The refund maths input from a stored bill. The API builds it from locked rows; the refund dialog
 * from the `order` query, so the amount it shows is the `expectedAmount` the server checks.
 */
export function refundSnapshotOf(order: {
  lines: readonly StoredRefundLine[];
  billGstAmount: string;
  refundedGstShare: string;
}): RefundOrderSnapshot {
  return {
    lines: order.lines.map((line) => ({
      id: line.id,
      quantity: line.quantity,
      refundedQuantity: line.refundedQuantity,
      lineNet: money(line.lineNet),
      lineTax: money(line.lineTax),
      refundedAmount: money(line.refundedAmount),
    })),
    billGstAmount: money(order.billGstAmount),
    refundedGstShare: money(order.refundedGstShare),
  };
}
