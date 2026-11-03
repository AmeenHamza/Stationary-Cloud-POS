import { Injectable } from '@nestjs/common';

import { DASHBOARD_MAX_DAYS } from '@pos/contracts';
import { addDays } from '@pos/domain';

import { moneyText } from '../../../common/graphql/scalars';
import { InsightMetricsRepository } from '../persistence/insight-metrics.repository';
import { SalesMetricsRepository } from '../persistence/sales-metrics.repository';

import { byKey, moneyOrNull, netOf } from './report-format';

const DAY_MS = 86_400_000;

/** Inclusive number of calendar days in [from, to] (business dates, `YYYY-MM-DD`). */
export function daysIn(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;
}

/**
 * Bounded aggregates behind the AI Assistant (SYSTEM_DESIGN.md §8, ADR-026): every list is at most
 * `limit` ≤ 50 rows, and nothing here names a customer or a phone number (Q17b).
 */
@Injectable()
export class InsightsService {
  constructor(
    private readonly sales: SalesMetricsRepository,
    private readonly insights: InsightMetricsRepository,
  ) {}

  /** Net sales, bills not fully refunded, discount, tax (Q30) and refunds (Q28) in [from, to]. */
  async totals(from: string, to: string) {
    const row = await this.sales.range(from, to);
    return {
      netSales: netOf(row),
      bills: row.billCount,
      discount: moneyText(row.discountTotal),
      tax: moneyText(row.taxTotal),
      refunds: moneyText(row.refunds),
    };
  }

  /** Net sales per day for ranges up to 31 days, otherwise per week (weeks start on Monday). */
  async series(from: string, to: string) {
    const days = daysIn(from, to);
    if (days <= DASHBOARD_MAX_DAYS) {
      const rows = byKey(await this.sales.days(from, to));
      return Array.from({ length: days }, (_, index) => {
        const date = addDays(from, index);
        return { period: date, netSales: netOf(rows.get(date)) };
      });
    }
    const weeks = await this.sales.weeks(from, to);
    return weeks
      .map((row) => ({ period: `week of ${row.key}`, netSales: netOf(row) }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }

  /** Sold or low-stock products with their rate over the window, soonest to run out first. */
  async velocity(to: string, windowDays: number, limit: number) {
    const rows = await this.insights.velocity(addDays(to, 1 - windowDays), to, windowDays, limit);
    return rows.map((row) => ({
      ...row,
      costPrice: moneyOrNull(row.costPrice),
      estimatedCost: moneyOrNull(row.estimatedCost),
    }));
  }

  async slowStock(to: string, windowDays: number, limit: number) {
    const rows = await this.insights.slowStock(addDays(to, 1 - windowDays), to, limit);
    return rows.map((row) => ({
      ...row,
      salePrice: moneyText(row.salePrice),
      costPrice: moneyOrNull(row.costPrice),
      stockCostValue: moneyText(row.stockCostValue),
    }));
  }

  lowStock(limit: number) {
    return this.insights.lowStock(limit);
  }

  /** Sales of up to `limit` products whose name contains `search`, over the window. */
  async productSales(search: string, to: string, windowDays: number, limit: number) {
    const ids = await this.insights.matchingProductIds(search, limit);
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.insights.productSales(ids, addDays(to, 1 - windowDays), to);
    return rows.map((row) => ({ ...row, total: moneyText(row.total) }));
  }
}
