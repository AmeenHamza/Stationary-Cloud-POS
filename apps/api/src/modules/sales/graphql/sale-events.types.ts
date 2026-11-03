import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

import { OrderStatusEnum, PaymentMethodEnum } from '../../../common/graphql/enums.registry';
import { BusinessDateScalar, MoneyScalar } from '../../../common/graphql/scalars';
import { ShopEvent } from '../../../common/graphql/shop-event.interface';

import type { OrderStatus, PaymentMethod } from '@pos/contracts';

/** `order.created` (admins): dashboard tiles and the "N new orders" banner (API.md §7.2). */
@ObjectType('OrderCreatedEvent', { implements: () => [ShopEvent] })
export class OrderCreatedEvent extends ShopEvent {
  @Field(() => ID)
  orderId!: string;

  @Field(() => String)
  billNumber!: string;

  @Field(() => MoneyScalar)
  total!: string;

  @Field(() => PaymentMethodEnum)
  paymentMethod!: PaymentMethod;

  @Field(() => BusinessDateScalar)
  businessDate!: string;
}

/** `order.refunded` (staff): patch the bill's status and refunded total. */
@ObjectType('OrderRefundedEvent', { implements: () => [ShopEvent] })
export class OrderRefundedEvent extends ShopEvent {
  @Field(() => ID)
  orderId!: string;

  @Field(() => OrderStatusEnum)
  status!: OrderStatus;

  @Field(() => MoneyScalar)
  refundedTotal!: string;

  @Field(() => Int)
  version!: number;
}
