import { z } from 'zod';

import {
  DASHBOARD_MAX_DAYS,
  RANKING_DIRECTIONS,
  RANKING_MAX_DAYS,
  RANKING_MAX_LIMIT,
  REPORT_PERIODS,
} from '@pos/contracts';

import { businessDateSchema, idSchema } from './common.js';

/** `dashboard(date)`: a business date, or today in Asia/Karachi when omitted (Q18). */
export const dashboardDateSchema = businessDateSchema.nullish().transform((value) => value ?? null);

/** `monthlySales(year)`: one calendar year. */
export const reportYearSchema = z.int().min(2000).max(2100);

/** `dailySales(days, productId)`: up to 31 days ending on the dashboard date (API.md §3). */
export const dailySalesArgsSchema = z.object({
  days: z.int().min(1).max(DASHBOARD_MAX_DAYS).default(7),
  productId: idSchema.nullish().transform((value) => value ?? null),
});
export type DailySalesArgs = z.output<typeof dailySalesArgsSchema>;

/** `paymentMethods(period)`: the current month by default (Q31). */
export const reportPeriodSchema = z.enum(REPORT_PERIODS).default('THIS_MONTH');

/** `productRanking(direction, limit, days)`: top or bottom ≤ 10 by units over ≤ 90 days (Q18). */
export const productRankingArgsSchema = z.object({
  direction: z.enum(RANKING_DIRECTIONS),
  limit: z.int().min(1).max(RANKING_MAX_LIMIT).default(5),
  days: z.int().min(1).max(RANKING_MAX_DAYS).default(30),
});
export type ProductRankingArgs = z.output<typeof productRankingArgsSchema>;
