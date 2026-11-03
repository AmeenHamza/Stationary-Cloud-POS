import { ArgsType, Field, ID, Int, ObjectType } from '@nestjs/graphql';

import { PaymentMethodEnum, RankingDirectionEnum } from '../../../common/graphql/enums.registry';
import { BusinessDateScalar, MoneyScalar } from '../../../common/graphql/scalars';

import type { PaymentMethod, RankingDirection } from '@pos/contracts';

/** The admin overview for one business date (API.md §6.3). Each field is resolved only if asked. */
@ObjectType('Dashboard')
export class Dashboard {
  @Field(() => BusinessDateScalar, {
    description: 'Today in Asia/Karachi unless a date was given.',
  })
  date!: string;

  /** Per-request memo, so fields sharing one aggregate run it once (not a GraphQL field). */
  memo!: Map<string, Promise<unknown>>;
}

@ObjectType('DaySummary')
export class DaySummary {
  @Field(() => MoneyScalar, { description: 'Bills of the day minus refunds made that day (Q28).' })
  netSales!: string;

  @Field(() => Int, { description: 'Bills of the day not fully refunded (Q18).' })
  billCount!: number;

  @Field(() => MoneyScalar)
  discountTotal!: string;

  @Field(() => MoneyScalar, { description: 'Product tax plus Bill GST (Q30).' })
  taxTotal!: string;

  @Field(() => MoneyScalar)
  refundTotal!: string;
}

@ObjectType('InventoryValue')
export class InventoryValue {
  @Field(() => MoneyScalar, { description: 'Σ stock × piece price, positive stock only.' })
  sellingValue!: string;

  @Field(() => MoneyScalar, { description: 'Σ stock × cost price, positive stock only.' })
  costValue!: string;

  @Field(() => Int, { description: 'Active products.' })
  productCount!: number;
}

@ObjectType('MonthlySales')
export class MonthlySales {
  @Field(() => Int, { description: '1–12.' })
  month!: number;

  @Field(() => MoneyScalar)
  total!: string;

  @Field(() => MoneyScalar)
  sameMonthLastYear!: string;
}

@ObjectType('DailySales')
export class DailySales {
  @Field(() => BusinessDateScalar)
  date!: string;

  @Field(() => MoneyScalar)
  total!: string;
}

@ObjectType('PeriodTotals')
export class PeriodTotals {
  @Field(() => MoneyScalar)
  today!: string;

  @Field(() => MoneyScalar, { description: 'Since Monday (Q18).' })
  thisWeek!: string;

  @Field(() => MoneyScalar)
  thisMonth!: string;
}

@ObjectType('TaxSummary')
export class TaxSummary {
  @Field(() => MoneyScalar)
  today!: string;

  @Field(() => MoneyScalar)
  thisMonth!: string;

  @Field(() => MoneyScalar, { description: 'This month’s tax per bill.' })
  averagePerBill!: string;
}

@ObjectType('PaymentMethodTotal')
export class PaymentMethodTotal {
  @Field(() => PaymentMethodEnum)
  method!: PaymentMethod;

  @Field(() => MoneyScalar, { description: 'Bills minus refunds made in the period.' })
  total!: string;

  @Field(() => Int)
  billCount!: number;
}

@ObjectType('ProductSales')
export class ProductSales {
  @Field(() => ID)
  productId!: string;

  @Field(() => String)
  name!: string;

  @Field(() => Int, { description: 'Pieces sold minus pieces returned.' })
  units!: number;

  @Field(() => MoneyScalar)
  total!: string;
}

@ArgsType()
export class DailySalesArgs {
  @Field(() => Int, { defaultValue: 7, description: '1–31 days ending on the dashboard date.' })
  days!: number;

  @Field(() => ID, { nullable: true })
  productId?: string | null;
}

@ArgsType()
export class ProductRankingArgs {
  @Field(() => RankingDirectionEnum)
  direction!: RankingDirection;

  @Field(() => Int, { defaultValue: 5, description: 'At most 10.' })
  limit!: number;

  @Field(() => Int, { defaultValue: 30, description: 'Look-back window, at most 90 days.' })
  days!: number;
}
