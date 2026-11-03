import { Injectable } from '@nestjs/common';

import { addDays, Decimal, round2, startOfMonth, startOfWeek } from '@pos/domain';

import { moneyText } from '../../../common/graphql/scalars';
import { ClockService } from '../../../common/time/clock.service';
import { SalesMetricsRepository } from '../persistence/sales-metrics.repository';
import { StockMetricsRepository } from '../persistence/stock-metrics.repository';

import { byKey, netOf } from './report-format';

import type { PaymentMethod, RankingDirection, ReportPeriod } from '@pos/contracts';
import type { DailySalesArgs, ProductRankingArgs } from '@pos/validation';

/**
 * Dashboard figures (F-06, F-07; API.md §6.3) for one business date. Periods follow Q18 (Asia/Karachi
 * dates, weeks from Monday), refunds count on their own date (Q28), tax is product tax + Bill GST
 * (Q30). Every number is one SQL aggregate; this service only shapes ranges and formats money.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly sales: SalesMetricsRepository,
    private readonly stock: StockMetricsRepository,
    private readonly clock: ClockService,
  ) {}

  today(): string {
    return this.clock.businessDate();
  }

  async day(date: string) {
    const row = await this.sales.range(date, date);
    return {
      netSales: netOf(row),
      billCount: row.billCount,
      discountTotal: moneyText(row.discountTotal),
      taxTotal: moneyText(row.taxTotal),
      refundTotal: moneyText(row.refunds),
    };
  }

  async inventory() {
    const row = await this.stock.inventory();
    return {
      sellingValue: moneyText(row.sellingValue),
      costValue: moneyText(row.costValue),
      productCount: row.productCount,
    };
  }

  async khataTotals() {
    const totals = await this.stock.khataTotals();
    return {
      customerDues: moneyText(totals.customerDues),
      customerCount: totals.customerCount,
      vendorOwes: moneyText(totals.vendorOwes),
      vendorCount: totals.vendorCount,
    };
  }

  async customerDues(): Promise<string> {
    return (await this.khataTotals()).customerDues;
  }

  async salesTotals(date: string) {
    const row = await this.sales.salesTotals(date, startOfWeek(date), startOfMonth(date));
    return {
      thisWeekSales: moneyText(row.thisWeekSales),
      thisMonthSales: moneyText(row.thisMonthSales),
    };
  }

  async categoryCount(): Promise<number> {
    return (await this.stock.categoryTotals()).categoryCount;
  }

  /** Discount and tax totals for today, this week and this month. */
  async periods(date: string) {
    const row = await this.sales.periods(date, startOfWeek(date), startOfMonth(date));
    const average =
      row.billsMonth === 0
        ? new Decimal(0)
        : round2(new Decimal(row.taxMonth).dividedBy(row.billsMonth));
    return {
      discount: {
        today: moneyText(row.discountToday),
        thisWeek: moneyText(row.discountWeek),
        thisMonth: moneyText(row.discountMonth),
      },
      tax: {
        today: moneyText(row.taxToday),
        thisMonth: moneyText(row.taxMonth),
        averagePerBill: moneyText(average),
      },
    };
  }

  /** Twelve months of `year`, each beside the same month of the year before. */
  async months(year: number) {
    const rows = byKey(await this.sales.months(year));
    return Array.from({ length: 12 }, (_, index) => {
      const month = String(index + 1).padStart(2, '0');
      return {
        month: index + 1,
        total: netOf(rows.get(`${String(year)}-${month}`)),
        sameMonthLastYear: netOf(rows.get(`${String(year - 1)}-${month}`)),
      };
    });
  }

  /** One row per day for the `days` days ending on `date`, all products or one. */
  async daily(date: string, args: DailySalesArgs) {
    const from = addDays(date, 1 - args.days);
    const rows = byKey(
      args.productId === null
        ? await this.sales.days(from, date)
        : await this.sales.productDays(args.productId, from, date),
    );
    return Array.from({ length: args.days }, (_, index) => {
      const day = addDays(from, index);
      return { date: day, total: netOf(rows.get(day)) };
    });
  }

  /** Net sales per payment method in the period, largest first (Q31: this month by default). */
  methods(date: string, period: ReportPeriod) {
    const from =
      period === 'TODAY' ? date : period === 'THIS_WEEK' ? startOfWeek(date) : startOfMonth(date);
    return this.methodsBetween(from, date);
  }

  /** Net sales and bills per payment method in [from, to], largest first. */
  async methodsBetween(from: string, to: string) {
    const rows = await this.sales.methods(from, to);
    return rows
      .map((row) => ({
        method: row.key as PaymentMethod,
        total: netOf(row),
        billCount: row.billCount,
      }))
      .sort((a, b) => new Decimal(b.total).comparedTo(a.total) || a.method.localeCompare(b.method));
  }

  /** Top or bottom products by net units over the `days` days ending on `date`. */
  ranking(date: string, args: ProductRankingArgs) {
    return this.rankingBetween(args.direction, args.limit, addDays(date, 1 - args.days), date);
  }

  async rankingBetween(direction: RankingDirection, limit: number, from: string, to: string) {
    const rows = await this.stock.ranking(direction, limit, from, to);
    return rows.map((row) => ({ ...row, total: moneyText(row.total) }));
  }
}
