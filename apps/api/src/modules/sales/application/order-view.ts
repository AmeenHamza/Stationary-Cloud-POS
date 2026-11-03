import { dateColumn } from '../../../common/time/date-column';

import type { OrderDetailRow, OrderLineRow, OrderRow } from '../persistence/orders.repository';

/** A bill header as GraphQL renders it: `YYYY-MM-DD` business date, the customer's name. */
export function toOrderView(row: OrderRow) {
  const { customer, businessDate, ...fields } = row;
  return {
    ...fields,
    businessDate: dateColumn(businessDate),
    customerName: customer?.name ?? null,
  };
}

export type OrderView = ReturnType<typeof toOrderView>;

function toLineView(row: OrderLineRow, refundedAmount: string) {
  return { ...row, id: row.id.toString(), refundedAmount };
}

export type OrderLineView = ReturnType<typeof toLineView>;

/**
 * A bill with its lines and what was refunded so far, which is everything the refund dialog needs
 * to preview a refund with the same domain function as the server (ADR-013).
 */
export function toOrderDetailView(
  row: OrderDetailRow,
  refunded: { byLine: ReadonlyMap<bigint, string>; gstShare: string },
) {
  return {
    ...toOrderView(row),
    lines: row.lines.map((line) => toLineView(line, refunded.byLine.get(line.id) ?? '0')),
    refundedGstShare: refunded.gstShare,
  };
}

export type OrderDetailView = ReturnType<typeof toOrderDetailView>;
