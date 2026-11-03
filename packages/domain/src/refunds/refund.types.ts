import type { Decimal } from '../money/decimal.js';

/** A sold line as stored on the order, with what has already been refunded. */
export interface RefundableLine {
  id: string;
  quantity: number;
  refundedQuantity: number;
  lineNet: Decimal;
  lineTax: Decimal;
  /** Σ earlier refund amounts for this line (net + product tax share, excluding Bill GST). */
  refundedAmount: Decimal;
}

export interface RefundOrderSnapshot {
  lines: readonly RefundableLine[];
  billGstAmount: Decimal;
  /** Σ Bill GST shares returned by earlier refunds. */
  refundedGstShare: Decimal;
}

export interface RefundRequestLine {
  lineId: string;
  quantity: number;
}

export interface RefundLineResult {
  lineId: string;
  quantity: number;
  amount: Decimal;
}

export interface RefundResult {
  lines: RefundLineResult[];
  gstShare: Decimal;
  amount: Decimal;
  /** True when this refund returns every remaining unit (order becomes REFUNDED). */
  completesOrder: boolean;
}
