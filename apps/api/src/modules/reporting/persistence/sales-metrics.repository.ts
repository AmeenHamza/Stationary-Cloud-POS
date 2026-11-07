import { Injectable } from '@nestjs/common';

import { Prisma } from '@pos/database';

import { TransactionalClient } from '../../../infrastructure/prisma/transactional-client';

import type { ReportPeriod } from '@pos/contracts';

/** Money comes back as text (exact decimals); dates as `YYYY-MM-DD`. */
export interface DayRow {
  sales: string;
  refunds: string;
  billCount: number;
  discountTotal: string;
  taxTotal: string;
}

export interface PeriodRow {
  discountToday: string;
  discountWeek: string;
  discountMonth: string;
  taxToday: string;
  taxMonth: string;
  billsMonth: number;
}

export interface SalesTotalsRow {
  thisWeekSales: string;
  thisMonthSales: string;
}

export interface AmountRow {
  key: string;
  sales: string;
  refunds: string;
}

export type MethodRow = AmountRow & { billCount: number };

/** Net sales and bill counts per payment method in [from, to] (refunds by their own method). */
const methodRows = (from: string, to: string): Prisma.Sql =>
  Prisma.sql`
    WITH s AS (SELECT payment_method AS key, sum(total) AS amount, count(*)::int AS bills
               FROM orders WHERE business_date BETWEEN ${from}::date AND ${to}::date GROUP BY 1),
         r AS (SELECT payment_method AS key, sum(amount) AS amount FROM refunds
               WHERE business_date BETWEEN ${from}::date AND ${to}::date GROUP BY 1)
    SELECT coalesce(s.key, r.key)::text AS key, coalesce(s.amount, 0)::text AS sales,
           coalesce(r.amount, 0)::text AS refunds, coalesce(s.bills, 0) AS "billCount"
    FROM s FULL JOIN r ON r.key = s.key`;

/** Bills by bill date minus refunds by refund date, per key (Q28: closed days never change). */
const net = (key: Prisma.Sql, refundKey: Prisma.Sql, from: string, to: string): Prisma.Sql =>
  Prisma.sql`
    WITH s AS (SELECT ${key} AS key, sum(total) AS amount FROM orders
               WHERE business_date BETWEEN ${from}::date AND ${to}::date GROUP BY 1),
         r AS (SELECT ${refundKey} AS key, sum(amount) AS amount FROM refunds
               WHERE business_date BETWEEN ${from}::date AND ${to}::date GROUP BY 1)
    SELECT coalesce(s.key, r.key)::text AS key, coalesce(s.amount, 0)::text AS sales,
           coalesce(r.amount, 0)::text AS refunds
    FROM s FULL JOIN r ON r.key = s.key`;

/**
 * Sales aggregates for the dashboard (API.md §6.3), each one SQL statement over the
 * `business_date` indexes; nothing is computed from fetched rows (rule 2, H1).
 */
@Injectable()
export class SalesMetricsRepository {
  constructor(private readonly db: TransactionalClient) {}

  /** Totals for [from, to]: bills by bill date, refunds by refund date (Q28). */
  async range(from: string, to: string): Promise<DayRow> {
    const [row] = await this.db.client.$queryRaw<DayRow[]>`
      SELECT coalesce(sum(total), 0)::text AS sales,
             (SELECT coalesce(sum(amount), 0) FROM refunds
              WHERE business_date BETWEEN ${from}::date AND ${to}::date)::text AS refunds,
             (count(*) FILTER (WHERE status <> 'REFUNDED'))::int AS "billCount",
             coalesce(sum(discount_total), 0)::text AS "discountTotal",
             coalesce(sum(product_tax_total + bill_gst_amount), 0)::text AS "taxTotal"
      FROM orders WHERE business_date BETWEEN ${from}::date AND ${to}::date`;
    if (row === undefined) throw new Error('aggregate returned no row');
    return row;
  }

  /** Discount and tax (product tax + Bill GST, Q30) for today, the week and the month. */
  async periods(today: string, weekStart: string, monthStart: string): Promise<PeriodRow> {
    const [row] = await this.db.client.$queryRaw<PeriodRow[]>`
      SELECT coalesce(sum(discount_total) FILTER (WHERE business_date = ${today}::date), 0)::text
               AS "discountToday",
             coalesce(sum(discount_total) FILTER (WHERE business_date >= ${weekStart}::date), 0)::text
               AS "discountWeek",
             coalesce(sum(discount_total) FILTER (WHERE business_date >= ${monthStart}::date), 0)::text
               AS "discountMonth",
             coalesce(sum(product_tax_total + bill_gst_amount)
               FILTER (WHERE business_date = ${today}::date), 0)::text AS "taxToday",
             coalesce(sum(product_tax_total + bill_gst_amount)
               FILTER (WHERE business_date >= ${monthStart}::date), 0)::text AS "taxMonth",
             (count(*) FILTER (WHERE business_date >= ${monthStart}::date))::int AS "billsMonth"
      FROM orders
      WHERE business_date >= least(${weekStart}::date, ${monthStart}::date)
        AND business_date <= ${today}::date`;
    if (row === undefined) throw new Error('aggregate returned no row');
    return row;
  }

  /** Net sales per calendar month of `year` and of the year before (`key` = `YYYY-MM`). */
  months(year: number): Promise<AmountRow[]> {
    const month = Prisma.sql`to_char(business_date, 'YYYY-MM')`;
    return this.db.client.$queryRaw<AmountRow[]>(
      net(month, month, `${String(year - 1)}-01-01`, `${String(year)}-12-31`),
    );
  }

  /** Net sales per day in [from, to] (`key` = `YYYY-MM-DD`). */
  days(from: string, to: string): Promise<AmountRow[]> {
    const day = Prisma.sql`business_date`;
    return this.db.client.$queryRaw<AmountRow[]>(net(day, day, from, to));
  }

  /** Net sales per week in [from, to] (`key` = the Monday, `YYYY-MM-DD`; Q18). */
  weeks(from: string, to: string): Promise<AmountRow[]> {
    const week = Prisma.sql`date_trunc('week', business_date)::date`;
    return this.db.client.$queryRaw<AmountRow[]>(net(week, week, from, to));
  }

  /** One product's sales per day: its lines' net + tax by bill date, minus its refunds by refund date. */
  productDays(productId: string, from: string, to: string): Promise<AmountRow[]> {
    return this.db.client.$queryRaw<AmountRow[]>`
      WITH s AS (SELECT o.business_date AS key, sum(l.line_net + l.line_tax) AS amount
                 FROM order_lines l JOIN orders o ON o.id = l.order_id
                 WHERE l.product_id = ${productId}::uuid
                   AND o.business_date BETWEEN ${from}::date AND ${to}::date GROUP BY 1),
           r AS (SELECT f.business_date AS key, sum(rl.amount) AS amount
                 FROM refund_lines rl JOIN refunds f ON f.id = rl.refund_id
                 JOIN order_lines l ON l.id = rl.order_line_id
                 WHERE l.product_id = ${productId}::uuid
                   AND f.business_date BETWEEN ${from}::date AND ${to}::date GROUP BY 1)
      SELECT coalesce(s.key, r.key)::text AS key, coalesce(s.amount, 0)::text AS sales,
             coalesce(r.amount, 0)::text AS refunds
      FROM s FULL JOIN r ON r.key = s.key`;
  }

  /** Net sales for this week and this month (Q18 ranges; refunds by refund date, Q28). */
  async salesTotals(today: string, weekStart: string, monthStart: string): Promise<SalesTotalsRow> {
    const [row] = await this.db.client.$queryRaw<SalesTotalsRow[]>`
      SELECT (
        (SELECT coalesce(sum(total), 0) FROM orders
         WHERE business_date BETWEEN ${weekStart}::date AND ${today}::date)
        -
        (SELECT coalesce(sum(amount), 0) FROM refunds
         WHERE business_date BETWEEN ${weekStart}::date AND ${today}::date)
      )::text AS "thisWeekSales",
      (
        (SELECT coalesce(sum(total), 0) FROM orders
         WHERE business_date BETWEEN ${monthStart}::date AND ${today}::date)
        -
        (SELECT coalesce(sum(amount), 0) FROM refunds
         WHERE business_date BETWEEN ${monthStart}::date AND ${today}::date)
      )::text AS "thisMonthSales"`;
    if (row === undefined) throw new Error('aggregate returned no row');
    return row;
  }

  methods(from: string, to: string): Promise<MethodRow[]> {
    return this.db.client.$queryRaw<MethodRow[]>(methodRows(from, to));
  }

  /** The same rows for today, the week and the month in one statement (the live dashboard's budget). */
  methodPeriods(
    today: string,
    weekStart: string,
    monthStart: string,
  ): Promise<(MethodRow & { period: ReportPeriod })[]> {
    return this.db.client.$queryRaw<(MethodRow & { period: ReportPeriod })[]>(Prisma.sql`
      SELECT 'TODAY' AS period, d.* FROM (${methodRows(today, today)}) d
      UNION ALL
      SELECT 'THIS_WEEK', w.* FROM (${methodRows(weekStart, today)}) w
      UNION ALL
      SELECT 'THIS_MONTH', m.* FROM (${methodRows(monthStart, today)}) m`);
  }
}
