import { Prisma } from './generated/prisma/client.js';

/** One DATABASE.md §12 rule, as a query listing the ids of the rows that break it. */
export interface IntegrityCheck {
  name: string;
  offenders: Prisma.Sql;
}

export interface IntegrityResult {
  name: string;
  count: number;
  /** The first 50 offending ids (bounded output). */
  ids: string[];
}

/** Khata balance = Σ entries, and the latest entry's `balance_after` = balance (one per kind). */
const khata = (parties: string, entries: string, key: string): Prisma.Sql =>
  Prisma.sql`
    SELECT p.id::text AS id FROM ${Prisma.raw(parties)} p
    LEFT JOIN LATERAL (
      SELECT sum(e.amount) AS total,
             (SELECT l.balance_after FROM ${Prisma.raw(entries)} l
              WHERE l.${Prisma.raw(key)} = p.id ORDER BY l.id DESC LIMIT 1) AS latest
      FROM ${Prisma.raw(entries)} e WHERE e.${Prisma.raw(key)} = p.id
    ) s ON true
    WHERE coalesce(s.total, 0) <> p.balance OR (s.latest IS NOT NULL AND s.latest <> p.balance)`;

export const INTEGRITY_CHECKS: readonly IntegrityCheck[] = [
  {
    name: 'Stock ledger',
    offenders: Prisma.sql`
      SELECT p.id::text AS id FROM products p
      LEFT JOIN (SELECT product_id, sum(quantity_pieces) AS total
                 FROM stock_movements GROUP BY product_id) m ON m.product_id = p.id
      WHERE coalesce(m.total, 0) <> p.stock_pieces`,
  },
  {
    name: 'Customer khata',
    offenders: khata('customers', 'customer_ledger_entries', 'customer_id'),
  },
  { name: 'Vendor khata', offenders: khata('vendors', 'vendor_ledger_entries', 'vendor_id') },
  {
    name: 'Order arithmetic',
    offenders: Prisma.sql`
      SELECT o.id::text AS id FROM orders o
      JOIN (SELECT order_id, sum(line_gross) AS gross, sum(line_discount) AS discount,
                   sum(line_tax) AS tax
            FROM order_lines GROUP BY order_id) l ON l.order_id = o.id
      WHERE l.gross <> o.subtotal OR l.discount <> o.discount_total OR l.tax <> o.product_tax_total`,
  },
  {
    name: 'Refund totals',
    offenders: Prisma.sql`
      SELECT o.id::text AS id FROM orders o
      LEFT JOIN (SELECT order_id, sum(amount) AS total FROM refunds GROUP BY order_id) r
        ON r.order_id = o.id
      WHERE coalesce(r.total, 0) <> o.refunded_total
      UNION ALL
      SELECT ol.id::text FROM order_lines ol
      LEFT JOIN (SELECT order_line_id, sum(quantity) AS total
                 FROM refund_lines GROUP BY order_line_id) r ON r.order_line_id = ol.id
      WHERE coalesce(r.total, 0) <> ol.refunded_quantity`,
  },
  {
    // New bills on a date are numbered after that date's migrated bills (MIG-05), if there are any.
    name: 'Bill numbers',
    offenders: Prisma.sql`
      SELECT c.business_date::text AS id FROM bill_number_counters c
      LEFT JOIN (SELECT business_date, count(*) AS bills,
                        count(DISTINCT split_part(bill_number, '-', 3)::int) AS distinct_numbers,
                        max(split_part(bill_number, '-', 3)::int) AS highest
                 FROM orders WHERE legacy_id IS NULL GROUP BY business_date) o
        ON o.business_date = c.business_date
      LEFT JOIN (SELECT business_date, max(split_part(bill_number, '-', 3)::int) AS highest
                 FROM orders WHERE legacy_id IS NOT NULL AND bill_number ~ '^ORD-[0-9]{8}-[0-9]+$'
                 GROUP BY business_date) m
        ON m.business_date = c.business_date
      WHERE coalesce(o.bills, 0) + coalesce(m.highest, 0) <> c.last_value
         OR coalesce(o.distinct_numbers, 0) <> coalesce(o.bills, 0)
         OR greatest(coalesce(o.highest, 0), coalesce(m.highest, 0)) <> c.last_value`,
  },
];

/** Runs every check: counts plus the first 50 offending ids each (DATABASE.md §12). */
export async function runIntegrityChecks(
  query: (sql: Prisma.Sql) => Promise<{ count: number; ids: string[] }[]>,
): Promise<IntegrityResult[]> {
  const results: IntegrityResult[] = [];
  for (const check of INTEGRITY_CHECKS) {
    const [row] = await query(Prisma.sql`
      WITH offenders AS (${check.offenders})
      SELECT count(*)::int AS count, ARRAY(SELECT id FROM offenders LIMIT 50) AS ids FROM offenders`);
    results.push({ name: check.name, count: row?.count ?? 0, ids: row?.ids ?? [] });
  }
  return results;
}
