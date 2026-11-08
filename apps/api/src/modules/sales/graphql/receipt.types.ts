import { Field, GraphQLISODateTime, ID, Int, ObjectType } from '@nestjs/graphql';

import {
  PaymentMethodEnum,
  RefundSettlementEnum,
  SaleUnitEnum,
} from '../../../common/graphql/enums.registry';
import {
  BusinessDateScalar,
  MoneyScalar,
  PercentScalar,
  type DecimalLike,
} from '../../../common/graphql/scalars';

import { Order, OrderDetail } from './order.types';

import type { PaymentMethod, RefundSettlement, SaleUnit } from '@pos/contracts';

@ObjectType('ReceiptLine')
export class ReceiptLine {
  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  nameUrdu!: string | null;

  @Field(() => SaleUnitEnum)
  unit!: SaleUnit;

  @Field(() => Int)
  quantity!: number;

  @Field(() => MoneyScalar)
  unitPrice!: DecimalLike;

  @Field(() => MoneyScalar, { description: 'Quantity × unit price, before discount and tax.' })
  lineTotal!: DecimalLike;

  @Field(() => MoneyScalar, { description: "This item's own discount (D-27)." })
  itemDiscount!: DecimalLike;
}

/** Everything an 80 mm receipt prints (SYSTEM_DESIGN.md §3.5, Q6b), with no further request. */
@ObjectType('Receipt')
export class Receipt {
  @Field(() => ID)
  orderId!: string;

  @Field(() => String)
  shopName!: string;

  @Field(() => String, { nullable: true })
  address!: string | null;

  @Field(() => String, { nullable: true })
  phone!: string | null;

  @Field(() => String, { nullable: true })
  logoDataUrl!: string | null;

  @Field(() => String, { nullable: true })
  footer!: string | null;

  @Field(() => String, { nullable: true })
  exchangeReturnPolicy!: string | null;

  @Field(() => String)
  billNumber!: string;

  @Field(() => BusinessDateScalar)
  businessDate!: string;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => String)
  cashierName!: string;

  @Field(() => String, { nullable: true, description: 'Udhaar bills only.' })
  customerName!: string | null;

  @Field(() => MoneyScalar, {
    nullable: true,
    description: 'Udhaar: khata balance after this bill.',
  })
  customerBalance!: string | null;

  @Field(() => PaymentMethodEnum)
  paymentMethod!: PaymentMethod;

  @Field(() => [ReceiptLine])
  lines!: ReceiptLine[];

  @Field(() => MoneyScalar)
  subtotal!: DecimalLike;

  @Field(() => MoneyScalar)
  discountTotal!: DecimalLike;

  @Field(() => MoneyScalar, { description: 'The part of discountTotal given on items (D-27).' })
  itemDiscountTotal!: DecimalLike;

  @Field(() => MoneyScalar)
  productTaxTotal!: DecimalLike;

  @Field(() => PercentScalar, { nullable: true })
  billGstRate!: DecimalLike | null;

  @Field(() => MoneyScalar)
  billGstAmount!: DecimalLike;

  @Field(() => MoneyScalar)
  total!: DecimalLike;
}

/** A product sold below zero stock (D-16): the sale went through; the cashier is told. */
@ObjectType('StockWarning')
export class StockWarning {
  @Field(() => ID)
  productId!: string;

  @Field(() => String)
  productName!: string;

  @Field(() => Int)
  stockAfter!: number;
}

@ObjectType('CreateSalePayload')
export class CreateSalePayload {
  @Field(() => Order)
  order!: Order;

  @Field(() => Receipt)
  receipt!: Receipt;

  @Field(() => [StockWarning])
  stockWarnings!: StockWarning[];

  @Field(() => Boolean, { description: 'True when the key matched an existing sale.' })
  replayed!: boolean;
}

@ObjectType('RefundSummary')
export class RefundSummary {
  @Field(() => ID)
  id!: string;

  @Field(() => MoneyScalar)
  amount!: DecimalLike;

  @Field(() => MoneyScalar)
  billGstShare!: DecimalLike;

  @Field(() => RefundSettlementEnum, { description: 'KHATA_CREDIT for Udhaar bills (A-03).' })
  settlement!: RefundSettlement;

  @Field(() => String, { nullable: true })
  reason!: string | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;
}

@ObjectType('RefundOrderPayload')
export class RefundOrderPayload {
  @Field(() => OrderDetail)
  order!: OrderDetail;

  @Field(() => RefundSummary)
  refund!: RefundSummary;

  @Field(() => Boolean)
  replayed!: boolean;
}
