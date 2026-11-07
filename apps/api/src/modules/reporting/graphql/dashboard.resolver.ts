import { Args, Int, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';

import * as schemas from '@pos/validation';

import { RequirePermission } from '../../../common/auth/access-policy';
import { ReportPeriodEnum } from '../../../common/graphql/enums.registry';
import { BusinessDateScalar, MoneyScalar } from '../../../common/graphql/scalars';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { DashboardService } from '../application/dashboard.service';

import {
  DailySales,
  DailySalesArgs,
  Dashboard,
  DaySummary,
  InventoryValue,
  MonthlySales,
  PaymentMethodTotal,
  PeriodTotals,
  ProductRankingArgs,
  ProductSales,
  TaxSummary,
} from './dashboard.types';

import type { ReportPeriod } from '@pos/contracts';

/**
 * `dashboard(date)` (admins, F-06, F-07). The query only fixes the date; every field below is one
 * SQL aggregate that runs only when the client selects it, so the live tiles and the history charts
 * are separate, small requests (NETWORK_OPTIMIZATION.md §4.2).
 */
@Resolver(() => Dashboard)
export class DashboardResolver {
  constructor(private readonly service: DashboardService) {}

  @Query(() => Dashboard)
  @RequirePermission('dashboard:read')
  dashboard(
    @Args(
      'date',
      { type: () => BusinessDateScalar, nullable: true },
      new ZodValidationPipe(schemas.dashboardDateSchema),
    )
    date: string | null,
  ): Dashboard {
    return { date: date ?? this.service.today(), memo: new Map() };
  }

  @ResolveField(() => DaySummary)
  today(@Parent() dashboard: Dashboard) {
    return this.service.day(dashboard.date);
  }

  @ResolveField(() => InventoryValue)
  inventory() {
    return this.service.inventory();
  }

  @ResolveField(() => MoneyScalar, { description: 'Σ positive customer khata balances.' })
  async customerDues(@Parent() dashboard: Dashboard) {
    return (await this.khata(dashboard)).customerDues;
  }

  @ResolveField(() => Int, { description: 'Active customers.' })
  async customerCount(@Parent() dashboard: Dashboard) {
    return (await this.khata(dashboard)).customerCount;
  }

  @ResolveField(() => MoneyScalar, { description: 'Σ positive vendor balances.' })
  async vendorOwes(@Parent() dashboard: Dashboard) {
    return (await this.khata(dashboard)).vendorOwes;
  }

  @ResolveField(() => Int, { description: 'Active vendors.' })
  async vendorCount(@Parent() dashboard: Dashboard) {
    return (await this.khata(dashboard)).vendorCount;
  }

  @ResolveField(() => MoneyScalar, { description: 'Net sales from Monday to date.' })
  async thisWeekSales(@Parent() dashboard: Dashboard) {
    return (await this.salesTotals(dashboard)).thisWeekSales;
  }

  @ResolveField(() => MoneyScalar, { description: 'Net sales from month start to date.' })
  async thisMonthSales(@Parent() dashboard: Dashboard) {
    return (await this.salesTotals(dashboard)).thisMonthSales;
  }

  @ResolveField(() => Int, { description: 'Total categories.' })
  categoryCount() {
    return this.service.categoryCount();
  }

  @ResolveField(() => PeriodTotals, { description: 'Discounts given (Q18 periods).' })
  async discountSummary(@Parent() dashboard: Dashboard) {
    return (await this.periods(dashboard)).discount;
  }

  @ResolveField(() => TaxSummary, { description: 'Product tax + Bill GST (Q30).' })
  async taxSummary(@Parent() dashboard: Dashboard) {
    return (await this.periods(dashboard)).tax;
  }

  @ResolveField(() => [MonthlySales], {
    description: '12 months, with the same month a year earlier.',
  })
  monthlySales(
    @Args('year', { type: () => Int }, new ZodValidationPipe(schemas.reportYearSchema))
    year: number,
  ) {
    return this.service.months(year);
  }

  @ResolveField(() => [DailySales], { description: 'At most 31 rows.' })
  dailySales(
    @Parent() dashboard: Dashboard,
    @Args(new ZodValidationPipe(schemas.dailySalesArgsSchema)) args: DailySalesArgs,
  ) {
    return this.service.daily(dashboard.date, {
      days: args.days,
      productId: args.productId ?? null,
    });
  }

  @ResolveField(() => [PaymentMethodTotal], { description: 'At most 6 rows (Q31).' })
  async paymentMethods(
    @Parent() dashboard: Dashboard,
    @Args(
      'period',
      { type: () => ReportPeriodEnum, defaultValue: 'THIS_MONTH' },
      new ZodValidationPipe(schemas.reportPeriodSchema),
    )
    period: ReportPeriod,
  ) {
    return (await this.methodsByPeriod(dashboard))[period];
  }

  @ResolveField(() => [ProductSales], { description: 'At most 10 rows, by units sold.' })
  productRanking(
    @Parent() dashboard: Dashboard,
    @Args(new ZodValidationPipe(schemas.productRankingArgsSchema)) args: ProductRankingArgs,
  ) {
    return this.service.ranking(dashboard.date, args);
  }

  /** Discount and tax share one aggregate. */
  private periods(dashboard: Dashboard) {
    return this.once(dashboard, 'periods', () => this.service.periods(dashboard.date));
  }

  private salesTotals(dashboard: Dashboard) {
    return this.once(dashboard, 'salesTotals', () => this.service.salesTotals(dashboard.date));
  }

  private khata(dashboard: Dashboard) {
    return this.once(dashboard, 'khata', () => this.service.khataTotals());
  }

  private methodsByPeriod(dashboard: Dashboard) {
    return this.once(dashboard, 'methods', () => this.service.methodsByPeriod(dashboard.date));
  }

  /** Runs `query` at most once per request, so fields sharing an aggregate share one statement. */
  private once<T>(dashboard: Dashboard, key: string, query: () => Promise<T>): Promise<T> {
    const cached = dashboard.memo.get(key) as Promise<T> | undefined;
    if (cached !== undefined) {
      return cached;
    }
    const pending = query();
    dashboard.memo.set(key, pending);
    return pending;
  }
}
