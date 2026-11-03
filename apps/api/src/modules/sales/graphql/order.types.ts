import { Field, GraphQLISODateTime, ID, Int, ObjectType } from '@nestjs/graphql';

import {
  DiscountTypeEnum,
  OrderStatusEnum,
  PaymentMethodEnum,
  SaleUnitEnum,
} from '../../../common/graphql/enums.registry';
import {
  BusinessDateScalar,
  MoneyScalar,
  PercentScalar,
  type DecimalLike,
} from '../../../common/graphql/scalars';
import { Connection } from '../../../common/pagination/connection.factory';

import type { DiscountType, OrderStatus, PaymentMethod, SaleUnit } from '@pos/contracts';

/** A bill header (DATABASE.md §4.10): an immutable financial snapshot plus refund totals. */
@ObjectType('Order')
export class Order {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { description: 'ORD-YYYYMMDD-NNN (BR-05).' })
  billNumber!: string;

  @Field(() => BusinessDateScalar)
  businessDate!: string;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => String)
  cashierName!: string;

  @Field(() => ID, { nullable: true })
  customerId!: string | null;

  @Field(() => String, { nullable: true })
  customerName!: string | null;

  @Field(() => PaymentMethodEnum)
  paymentMethod!: PaymentMethod;

  @Field(() => DiscountTypeEnum)
  discountType!: DiscountType;

  @Field(() => MoneyScalar, { description: 'The flat amount, or the percentage for PERCENT.' })
  discountValue!: DecimalLike;

  @Field(() => MoneyScalar)
  subtotal!: DecimalLike;

  @Field(() => MoneyScalar)
  discountTotal!: DecimalLike;

  @Field(() => MoneyScalar)
  productTaxTotal!: DecimalLike;

  @Field(() => PercentScalar, {
    nullable: true,
    description: 'Null when Bill GST was not applied.',
  })
  billGstRate!: DecimalLike | null;

  @Field(() => MoneyScalar)
  billGstAmount!: DecimalLike;

  @Field(() => MoneyScalar)
  total!: DecimalLike;

  @Field(() => MoneyScalar)
  refundedTotal!: DecimalLike;

  @Field(() => OrderStatusEnum)
  status!: OrderStatus;

  @Field(() => Int)
  version!: number;
}

@ObjectType('OrderLine')
export class OrderLine {
  @Field(() => ID)
  id!: string;

  @Field(() => Int)
  lineNo!: number;

  @Field(() => ID, { nullable: true })
  productId!: string | null;

  @Field(() => String)
  productName!: string;

  @Field(() => String, { nullable: true })
  productNameUrdu!: string | null;

  @Field(() => String, { nullable: true })
  barcode!: string | null;

  @Field(() => SaleUnitEnum)
  saleUnit!: SaleUnit;

  @Field(() => Int, { description: '1 for PIECE; pieces per box at sale time for BOX.' })
  piecesPerUnit!: number;

  @Field(() => Int)
  quantity!: number;

  @Field(() => MoneyScalar)
  unitPrice!: DecimalLike;

  @Field(() => PercentScalar)
  taxRate!: DecimalLike;

  @Field(() => MoneyScalar)
  lineGross!: DecimalLike;

  @Field(() => MoneyScalar)
  lineDiscount!: DecimalLike;

  @Field(() => MoneyScalar)
  lineNet!: DecimalLike;

  @Field(() => MoneyScalar)
  lineTax!: DecimalLike;

  @Field(() => Int)
  refundedQuantity!: number;

  @Field(() => MoneyScalar, { description: 'Σ earlier refunds of this line (net + product tax).' })
  refundedAmount!: string;
}

/** One bill with its lines: what the refund dialog needs to preview a refund (A-06). */
@ObjectType('OrderDetail')
export class OrderDetail extends Order {
  @Field(() => [OrderLine], { description: 'At most 100 (Q34).' })
  lines!: OrderLine[];

  @Field(() => MoneyScalar, { description: 'Σ Bill GST returned by earlier refunds.' })
  refundedGstShare!: string;
}

@ObjectType('OrderConnection')
export class OrderConnection extends Connection(Order) {}
