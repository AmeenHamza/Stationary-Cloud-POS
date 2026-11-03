import { Prisma } from '@pos/database';

/**
 * CTEs `sold`, `returned` and `net`: each product's pieces and amount in [from, to], sales by bill
 * date minus returns by refund date (Q18, Q28, Q36). Use as `WITH ${netProductSales(from, to)} …`.
 */
export const netProductSales = (from: string, to: string): Prisma.Sql => Prisma.sql`
  sold AS (
    SELECT l.product_id, sum(l.quantity * l.pieces_per_unit) AS pieces,
           sum(l.line_net + l.line_tax) AS amount
    FROM order_lines l JOIN orders o ON o.id = l.order_id
    WHERE o.business_date BETWEEN ${from}::date AND ${to}::date AND l.product_id IS NOT NULL
    GROUP BY l.product_id),
  returned AS (
    SELECT l.product_id, sum(rl.quantity * l.pieces_per_unit) AS pieces, sum(rl.amount) AS amount
    FROM refund_lines rl JOIN refunds f ON f.id = rl.refund_id
    JOIN order_lines l ON l.id = rl.order_line_id
    WHERE f.business_date BETWEEN ${from}::date AND ${to}::date AND l.product_id IS NOT NULL
    GROUP BY l.product_id),
  net AS (
    SELECT s.product_id, s.pieces - coalesce(t.pieces, 0) AS pieces,
           s.amount - coalesce(t.amount, 0) AS amount
    FROM sold s LEFT JOIN returned t ON t.product_id = s.product_id)`;
