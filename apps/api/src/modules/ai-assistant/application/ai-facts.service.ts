import { Injectable } from '@nestjs/common';

import { AI_FORECAST_DAYS, AI_MAX_ROWS, AI_PURCHASE_DAYS } from '@pos/contracts';
import { addDays } from '@pos/domain';

import { DashboardService, InsightsService, daysIn } from '../../reporting';

/** Ranked product lists in sales facts. */
const TOP_PRODUCTS = 10;
const SLOWEST_PRODUCTS = 10;
const REPORT_LOW_STOCK = 20;
const DISCOUNT_CANDIDATES = 30;
/** Discount advice looks at the last 30 days of sales, like the forecast (Q38). */
const DISCOUNT_DAYS = 30;

/** Ranked products without internal ids: the model needs names and numbers only. */
export const namesAndNumbers = (rows: readonly { name: string; units: number; total: string }[]) =>
  rows.map(({ name, units, total }) => ({ name, units, total }));

/**
 * The data each AI feature sends to the model (SYSTEM_DESIGN.md §8 step 3): bounded aggregates from
 * `reporting`, at most 50 rows per list, product names and numbers only, never customer names,
 * phones or ledgers (Q17b).
 */
@Injectable()
export class AiFactsService {
  constructor(
    private readonly insights: InsightsService,
    private readonly dashboard: DashboardService,
  ) {}

  /** Totals, the same-length previous period, the series, payment methods and rankings. */
  async sales(from: string, to: string) {
    const days = daysIn(from, to);
    const previousTo = addDays(from, -1);
    const previousFrom = addDays(previousTo, 1 - days);
    return {
      period: { from, to, days },
      totals: await this.insights.totals(from, to),
      previousPeriod: {
        from: previousFrom,
        to: previousTo,
        totals: await this.insights.totals(previousFrom, previousTo),
      },
      series: await this.insights.series(from, to),
      paymentMethods: await this.dashboard.methodsBetween(from, to),
      topProducts: namesAndNumbers(
        await this.dashboard.rankingBetween('HIGHEST', TOP_PRODUCTS, from, to),
      ),
      slowestProducts: namesAndNumbers(
        await this.dashboard.rankingBetween('LOWEST', SLOWEST_PRODUCTS, from, to),
      ),
    };
  }

  /** Sales facts plus stock, inventory value and total customer dues (an aggregate only). */
  async report(from: string, to: string) {
    return {
      ...(await this.sales(from, to)),
      lowStock: await this.insights.lowStock(REPORT_LOW_STOCK),
      inventory: await this.dashboard.inventory(),
      customerDuesTotal: await this.dashboard.customerDues(),
    };
  }

  async forecast(today: string) {
    return {
      windowDays: AI_FORECAST_DAYS,
      products: await this.insights.velocity(today, AI_FORECAST_DAYS, AI_MAX_ROWS),
    };
  }

  async purchases(today: string) {
    return {
      windowDays: AI_PURCHASE_DAYS,
      horizonDays: 30,
      products: await this.insights.velocity(today, AI_PURCHASE_DAYS, AI_MAX_ROWS),
    };
  }

  async discounts(today: string) {
    return {
      windowDays: DISCOUNT_DAYS,
      products: await this.insights.slowStock(today, DISCOUNT_DAYS, DISCOUNT_CANDIDATES),
    };
  }
}
