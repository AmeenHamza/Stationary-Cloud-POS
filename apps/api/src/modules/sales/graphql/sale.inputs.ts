import { ArgsType, Field, ID, InputType, Int } from '@nestjs/graphql';

import {
  DiscountTypeEnum,
  OrderStatusEnum,
  PaymentMethodEnum,
  SaleUnitEnum,
} from '../../../common/graphql/enums.registry';
import { BusinessDateScalar, MoneyScalar, PercentScalar } from '../../../common/graphql/scalars';
import { PageArgs } from '../../../common/pagination/page.args';

import type { DiscountType, OrderStatus, PaymentMethod, SaleUnit } from '@pos/contracts';

/** Shapes only; validation is in `@pos/validation` (sales.schemas.ts). */
@InputType()
export class SaleLineInput {
  @Field(() => ID)
  productId!: string;

  @Field(() => SaleUnitEnum)
  unit!: SaleUnit;

  @Field(() => Int)
  quantity!: number;
}

@InputType()
export class CustomSaleLineInput {
  @Field(() => String)
  name!: string;

  @Field(() => SaleUnitEnum)
  unit!: SaleUnit;

  @Field(() => Int)
  quantity!: number;

  @Field(() => MoneyScalar)
  unitPrice!: string;

  @Field(() => PercentScalar)
  taxRate!: string;
}

@InputType()
export class DiscountInput {
  @Field(() => DiscountTypeEnum)
  type!: DiscountType;

  @Field(() => MoneyScalar, { nullable: true, description: 'FLAT only.' })
  amount?: string | null;

  @Field(() => PercentScalar, { nullable: true, description: 'PERCENT only.' })
  percent?: string | null;
}

@InputType()
export class BillGstInput {
  @Field(() => Boolean)
  applied!: boolean;

  @Field(() => PercentScalar, { nullable: true, description: 'Required when applied.' })
  rate?: string | null;
}

/** API.md §10.2. Prices are never sent: the server prices the locked products. */
@InputType()
export class CreateSaleInput {
  @Field(() => ID)
  idempotencyKey!: string;

  @Field(() => [SaleLineInput], { description: 'Catalog lines from products.' })
  lines!: SaleLineInput[];

  @Field(() => [CustomSaleLineInput], {
    nullable: true,
    description: 'Optional custom lines not in the catalogue.',
  })
  customLines?: CustomSaleLineInput[] | null;

  @Field(() => DiscountInput)
  discount!: DiscountInput;

  @Field(() => BillGstInput)
  billGst!: BillGstInput;

  @Field(() => PaymentMethodEnum)
  paymentMethod!: PaymentMethod;

  @Field(() => ID, { nullable: true, description: 'Required for UDHAAR (D-15).' })
  customerId?: string | null;

  @Field(() => MoneyScalar, {
    description: 'The total the cashier saw (PRICE_CHANGED if different).',
  })
  expectedTotal!: string;
}

@InputType()
export class RefundLineInput {
  @Field(() => ID)
  orderLineId!: string;

  @Field(() => Int)
  quantity!: number;
}

@InputType()
export class RefundOrderInput {
  @Field(() => ID)
  idempotencyKey!: string;

  @Field(() => ID)
  orderId!: string;

  @Field(() => [RefundLineInput], { nullable: true, description: 'Or set refundAll.' })
  lines?: RefundLineInput[] | null;

  @Field(() => Boolean, { nullable: true })
  refundAll?: boolean | null;

  @Field(() => String, { nullable: true })
  reason?: string | null;

  @Field(() => MoneyScalar, {
    description: 'The amount the cashier saw (QUOTE_MISMATCH if different).',
  })
  expectedAmount!: string;
}

@InputType()
export class OrdersFilter {
  @Field(() => String, { nullable: true, description: 'e.g. "ORD-20261028".' })
  billNumberPrefix?: string | null;

  @Field(() => OrderStatusEnum, { nullable: true })
  status?: OrderStatus | null;

  @Field(() => BusinessDateScalar, { nullable: true })
  from?: string | null;

  @Field(() => BusinessDateScalar, { nullable: true })
  to?: string | null;

  @Field(() => ID, { nullable: true })
  customerId?: string | null;

  @Field(() => Boolean, { nullable: true, description: 'Older than 90 days too (F-35).' })
  includeArchived?: boolean | null;
}

@ArgsType()
export class OrdersArgs extends PageArgs {
  @Field(() => OrdersFilter, { nullable: true })
  filter?: OrdersFilter | null;
}
