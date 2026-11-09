import { fixed, insertRows } from './insert.js';
import { checkpoint, columns, type StepResult, type WriteContext } from './step.js';

import type { CounterPlan } from '../transform/counters.js';
import type { OrderPlan } from '../transform/orders.js';

const ORDER_COLUMNS = columns(`id legacy_id bill_number business_date idempotency_key cashier_name
  customer_id payment_method discount_type discount_value subtotal discount_total item_discount_total
  product_tax_total bill_gst_rate bill_gst_amount total refunded_total status created_at`);

const LINE_COLUMNS = columns(`order_id line_no product_id product_name product_name_urdu barcode
  sale_unit pieces_per_unit quantity unit_price tax_rate line_gross item_discount line_discount
  line_net line_tax refunded_quantity`);

const REFUND_COLUMNS = columns(`id order_id idempotency_key business_date amount bill_gst_share
  settlement payment_method created_at`);

const orderRow = (o: OrderPlan) => [
  ...[o.id, o.legacyId, o.billNumber, o.businessDate, o.idempotencyKey, o.cashierName],
  ...[o.customerId, o.paymentMethod, o.discountType, fixed(o.discountValue), fixed(o.subtotal)],
  ...[fixed(o.discountTotal), fixed(o.itemDiscountTotal), fixed(o.productTaxTotal)],
  ...[fixed(o.billGstRate), fixed(o.billGstAmount), fixed(o.total), fixed(o.refundedTotal)],
  ...[o.status, o.createdAt],
];

/**
 * Bills, then their lines and refunds. Lines and refunds are written only for bills inserted by this
 * run: a bill that already exists was written with its lines and refund in the same transaction.
 */
export async function writeOrders(
  context: WriteContext,
  orders: readonly OrderPlan[],
): Promise<StepResult[]> {
  const { client, batchSize } = context;
  const bills = await insertRows<{ id: string }>(
    client,
    { table: 'orders', columns: ORDER_COLUMNS, conflict: '(id)', returning: 'id' },
    orders.map(orderRow),
    batchSize,
  );
  const inserted = new Set(bills.rows.map((row) => row.id));
  const fresh = orders.filter((order) => inserted.has(order.id));
  const lines = await insertRows<{ id: string; order_id: string; line_no: number }>(
    client,
    {
      table: 'order_lines',
      columns: LINE_COLUMNS,
      conflict: '(order_id, line_no)',
      returning: 'id::text AS id, order_id, line_no',
    },
    fresh.flatMap((o) =>
      o.lines.map((l) => [
        ...[o.id, l.lineNo, l.productId, l.productName, l.productNameUrdu, l.barcode, l.saleUnit],
        ...[l.piecesPerUnit, l.quantity, fixed(l.unitPrice), fixed(l.taxRate), fixed(l.lineGross)],
        ...[fixed(l.itemDiscount), fixed(l.lineDiscount), fixed(l.lineNet), fixed(l.lineTax)],
        l.refundedQuantity,
      ]),
    ),
    batchSize,
  );
  const lineId = new Map(
    lines.rows.map((row) => [`${row.order_id}:${String(row.line_no)}`, row.id]),
  );
  const refunded = fresh.flatMap((o) =>
    o.refund === null ? [] : [{ order: o, refund: o.refund }],
  );
  const refunds = await insertRows(
    client,
    { table: 'refunds', columns: REFUND_COLUMNS, conflict: '(id)' },
    refunded.map(({ order, refund: r }) => [
      ...[r.id, order.id, r.idempotencyKey, r.businessDate, fixed(r.amount), fixed(r.billGstShare)],
      ...[r.settlement, r.paymentMethod, r.createdAt],
    ]),
    batchSize,
  );
  const refundLines = await insertRows(
    client,
    {
      table: 'refund_lines',
      columns: columns('refund_id order_line_id quantity amount'),
      conflict: '(refund_id, order_line_id)',
    },
    refunded.flatMap(({ order, refund }) =>
      refund.lines.map((line) => [
        refund.id,
        lineId.get(`${order.id}:${String(line.lineNo)}`) ?? null,
        line.quantity,
        fixed(line.amount),
      ]),
    ),
    batchSize,
  );
  return [
    checkpoint(context, 'orders', bills),
    checkpoint(context, 'order_lines', lines),
    checkpoint(context, 'refunds', refunds),
    checkpoint(context, 'refund_lines', refundLines),
  ];
}

/** Each date's counter becomes at least its highest migrated bill number (MIG-05); never lowered. */
export async function writeCounters(
  context: WriteContext,
  counters: readonly CounterPlan[],
): Promise<StepResult> {
  const response = await context.client.query(
    `INSERT INTO bill_number_counters (business_date, last_value)
     SELECT * FROM unnest($1::date[], $2::int[])
     ON CONFLICT (business_date) DO UPDATE SET last_value = EXCLUDED.last_value
     WHERE bill_number_counters.last_value < EXCLUDED.last_value`,
    [counters.map((c) => c.businessDate), counters.map((c) => c.lastValue)],
  );
  return checkpoint(context, 'bill_number_counters', {
    planned: counters.length,
    inserted: response.rowCount ?? 0,
  });
}
