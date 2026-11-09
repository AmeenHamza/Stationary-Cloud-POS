import { ISO_UTC } from '../legacy/reader.js';

import type { Facts, RecordFields } from './facts.js';
import type pg from 'pg';

const at = (column: string): string => `to_char(${column} AT TIME ZONE 'UTC', ${ISO_UTC})`;
const rs = (expression: string): string => `coalesce(${expression}, 0)::numeric(16,2)::text`;
const MIGRATED_ORDERS = 'JOIN orders o ON o.id = r.order_id WHERE o.legacy_id IS NOT NULL';

const RECORDS: Readonly<Record<keyof Facts['records'], string>> = {
  categories: `SELECT legacy_id AS id, ${at('created_at')} AS "createdAt" FROM categories
    WHERE legacy_id IS NOT NULL`,
  products: `SELECT legacy_id AS id, stock_pieces::text AS stock, sale_price::text AS price,
    coalesce(cost_price::text, 'none') AS cost, ${at('created_at')} AS "createdAt" FROM products
    WHERE legacy_id IS NOT NULL`,
  customers: `SELECT legacy_id AS id, balance::text AS balance, ${at('created_at')} AS "createdAt"
    FROM customers WHERE legacy_id IS NOT NULL`,
  vendors: `SELECT legacy_id AS id, balance::text AS balance, ${at('created_at')} AS "createdAt"
    FROM vendors WHERE legacy_id IS NOT NULL`,
  orders: `SELECT o.legacy_id AS id, o.bill_number AS "billNumber", o.total::text AS total,
    o.refunded_total::text AS refunded, o.payment_method::text AS method,
    coalesce(c.legacy_id, 'none') AS customer, ${at('o.created_at')} AS "createdAt"
    FROM orders o LEFT JOIN customers c ON c.id = o.customer_id WHERE o.legacy_id IS NOT NULL`,
  customerEntries: `SELECT legacy_id AS id, amount::text AS amount, ${at('created_at')} AS "createdAt"
    FROM customer_ledger_entries WHERE legacy_id IS NOT NULL`,
  vendorEntries: `SELECT legacy_id AS id, amount::text AS amount, ${at('created_at')} AS "createdAt"
    FROM vendor_ledger_entries WHERE legacy_id IS NOT NULL`,
};

const COUNTS = `SELECT
  (SELECT count(*)::int FROM order_lines r ${MIGRATED_ORDERS}) AS lines,
  (SELECT count(*)::int FROM order_lines r ${MIGRATED_ORDERS} AND r.product_id IS NOT NULL)
    AS "linesWithProduct",
  (SELECT count(*)::int FROM refunds r ${MIGRATED_ORDERS}) AS refunds,
  (SELECT count(*)::int FROM refund_lines rl JOIN refunds r ON r.id = rl.refund_id ${MIGRATED_ORDERS})
    AS "refundLines",
  (SELECT count(*)::int FROM stock_movements m JOIN products p ON p.id = m.product_id
    WHERE m.type = 'MIGRATION' AND p.legacy_id IS NOT NULL) AS "stockMovements"`;

const ledger = (table: string, sign: string) =>
  `(SELECT ${rs(`sum(${sign}amount)`)} FROM ${table} WHERE legacy_id IS NOT NULL AND ${sign}amount > 0)`;

const TOTALS = `SELECT ${rs('sum(total)')} AS sales, ${rs('sum(subtotal)')} AS subtotal,
  ${rs('sum(discount_total)')} AS discounts, ${rs('sum(product_tax_total)')} AS "productTax",
  ${rs('sum(bill_gst_amount)')} AS "billGst", ${rs('sum(refunded_total)')} AS refunded,
  ${rs('sum(total)')} AS "billPayments",
  ${ledger('customer_ledger_entries', '')} AS "customerDebits",
  ${ledger('customer_ledger_entries', '-')} AS "customerCredits",
  ${ledger('vendor_ledger_entries', '')} AS "vendorPurchases",
  ${ledger('vendor_ledger_entries', '-')} AS "vendorPayments",
  (SELECT coalesce(sum(stock_pieces), 0)::text FROM products WHERE legacy_id IS NOT NULL) AS "stockPieces",
  (SELECT ${rs('sum(stock_pieces * sale_price)')} FROM products WHERE legacy_id IS NOT NULL)
    AS "stockAtPrice",
  (SELECT ${rs('sum(stock_pieces * cost_price)')} FROM products WHERE legacy_id IS NOT NULL)
    AS "stockAtCost"
  FROM orders WHERE legacy_id IS NOT NULL`;

const GROUPS: Readonly<Record<keyof Facts['groups'], string>> = {
  salesByMonth: `SELECT to_char(created_at AT TIME ZONE $1, 'YYYY-MM') AS key, ${rs('sum(total)')} AS value
    FROM orders WHERE legacy_id IS NOT NULL GROUP BY 1`,
  billPaymentsByMethod: `SELECT payment_method::text AS key, ${rs('sum(total)')} AS value
    FROM orders WHERE legacy_id IS NOT NULL GROUP BY 1`,
  vendorPaymentsByMethod: `SELECT payment_method::text AS key, ${rs('-sum(amount)')} AS value
    FROM vendor_ledger_entries WHERE legacy_id IS NOT NULL AND type = 'PAYMENT' GROUP BY 1`,
};

async function recordsOf(client: pg.ClientBase, sql: string): Promise<Map<string, RecordFields>> {
  const { rows } = await client.query<RecordFields & { id: string }>(sql);
  return new Map(rows.map(({ id, ...fields }) => [id, fields]));
}

/** The new side of the validation: migrated rows only (those with a `legacy_id`). Reads only. */
export async function targetFacts(client: pg.ClientBase, timeZone: string): Promise<Facts> {
  const records = {} as Facts['records'];
  for (const [key, sql] of Object.entries(RECORDS) as [keyof Facts['records'], string][]) {
    records[key] = await recordsOf(client, sql);
  }
  const groups = {} as Facts['groups'];
  for (const [key, sql] of Object.entries(GROUPS) as [keyof Facts['groups'], string][]) {
    const params = sql.includes('$1') ? [timeZone] : []; // only sales by month needs the zone
    const { rows } = await client.query<{ key: string; value: string }>(sql, params);
    groups[key] = new Map(rows.map((row) => [row.key, row.value]));
  }
  const counts = (await client.query<Facts['counts']>(COUNTS)).rows[0];
  const totals = (await client.query<Facts['totals']>(TOTALS)).rows[0];
  if (counts === undefined || totals === undefined) {
    throw new Error('The new database returned no totals');
  }
  return { counts, totals, groups, records };
}
