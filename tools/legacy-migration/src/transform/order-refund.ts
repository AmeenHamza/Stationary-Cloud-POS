import { Decimal, ZERO, allocate, round2, sum } from '@pos/domain';

import { legacyUuid } from './values.js';

import type { Issues } from './issues.js';
import type { LinePlan } from './order-lines.js';
import type { PaymentMethod, RefundSettlement } from '@pos/contracts';

export interface RefundLinePlan {
  lineNo: number;
  quantity: number;
  amount: Decimal;
}

export interface RefundPlan {
  id: string;
  idempotencyKey: string;
  amount: Decimal;
  billGstShare: Decimal;
  settlement: RefundSettlement;
  paymentMethod: PaymentMethod;
  lines: RefundLinePlan[];
  /** Not recorded by the old app: the bill's time, or its khata refund entry's (Q43). */
  createdAt: Date;
  businessDate: string;
}

/**
 * The old app keeps only a refunded amount per bill and a refunded quantity per item. Each refunded
 * bill becomes one refund for that amount (its date is unknown, so it takes the bill's date, Q43), split
 * over the refunded items by their value, so refunded totals match (DATABASE.md §12).
 */
export function planRefund(
  legacyOrderId: string,
  refunded: Decimal,
  lines: readonly LinePlan[],
  bill: {
    total: Decimal;
    billGst: Decimal;
    method: PaymentMethod;
    createdAt: Date;
    businessDate: string;
  },
  issues: Issues,
  ref: string,
): RefundPlan | null {
  const refundedLines = lines.filter((line) => line.refundedQuantity > 0);
  if (refunded.isZero() && refundedLines.length === 0) {
    return null;
  }
  // greaterThan, not isPositive: decimal.js counts zero as positive.
  if (!refunded.greaterThan(0) || refunded.greaterThan(bill.total)) {
    issues.block(
      'refund-mismatch',
      ref,
      `refunded amount ${refunded.toFixed(2)} on a bill of ${bill.total.toFixed(2)}`,
    );
    return null;
  }
  const billGstShare = bill.total.isZero()
    ? ZERO
    : Decimal.min(round2(bill.billGst.times(refunded).dividedBy(bill.total)), refunded);
  const value = (line: LinePlan): Decimal =>
    line.lineNet.plus(line.lineTax).times(line.refundedQuantity).dividedBy(line.quantity);
  const goods = refunded.minus(billGstShare);
  const shares = sum(refundedLines.map(value)).isZero()
    ? refundedLines.map(() => ZERO)
    : allocate(goods, refundedLines, value).map((allocation) => allocation.share);
  return {
    id: legacyUuid('refund', legacyOrderId),
    idempotencyKey: legacyUuid('refund-key', legacyOrderId),
    amount: refunded,
    billGstShare,
    settlement: bill.method === 'UDHAAR' ? 'KHATA_CREDIT' : 'ORIGINAL_METHOD',
    paymentMethod: bill.method,
    lines: refundedLines.map((line, index) => ({
      lineNo: line.lineNo,
      quantity: line.refundedQuantity,
      amount: shares[index] ?? ZERO,
    })),
    createdAt: bill.createdAt,
    businessDate: bill.businessDate,
  };
}
