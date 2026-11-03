import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import * as schemas from '@pos/validation';

import { RequirePermission } from '../../../common/auth/access-policy';
import { CurrentViewer } from '../../../common/auth/current-viewer.decorator';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { OrderQueriesService } from '../application/order-queries.service';
import { RefundOrderService } from '../application/refund-order.service';

import { Order, OrderConnection, OrderDetail } from './order.types';
import { Receipt, RefundOrderPayload } from './receipt.types';
import * as inputs from './sale.inputs';

import type { Principal } from '../../../common/auth/principal';
import type { ConnectionValue } from '../../../common/pagination/connection.factory';

/** Order history, reprints and refunds (F-15, F-16, D-11: cashiers refund too). */
@Resolver(() => Order)
export class OrdersResolver {
  constructor(
    private readonly queries: OrderQueriesService,
    private readonly refunds: RefundOrderService,
  ) {}

  @Query(() => OrderConnection, { description: 'Newest first; 90 days unless dated or archived.' })
  @RequirePermission('orders:read')
  orders(
    // The pipe returns the parsed arguments (defaults applied, prefix upper-cased).
    @Args(new ZodValidationPipe(schemas.ordersArgsSchema)) args: inputs.OrdersArgs,
  ): Promise<ConnectionValue<Order>> {
    return this.queries.list(args);
  }

  @Query(() => OrderDetail, { nullable: true })
  @RequirePermission('orders:read')
  order(
    @Args('id', { type: () => ID }, new ZodValidationPipe(schemas.idSchema)) id: string,
  ): Promise<OrderDetail | null> {
    return this.queries.detail(id);
  }

  @Query(() => Receipt, { description: 'Reprint (SYSTEM_DESIGN.md §3.5).' })
  @RequirePermission('orders:read')
  orderReceipt(
    @Args('orderId', { type: () => ID }, new ZodValidationPipe(schemas.idSchema)) orderId: string,
  ): Promise<Receipt> {
    return this.queries.receipt(orderId);
  }

  @Mutation(() => RefundOrderPayload)
  @RequirePermission('orders:refund')
  refundOrder(
    @Args(
      'input',
      { type: () => inputs.RefundOrderInput },
      new ZodValidationPipe(schemas.refundOrderInputSchema),
    )
    input: schemas.RefundOrderInput,
    @CurrentViewer() viewer: Principal,
  ): Promise<RefundOrderPayload> {
    return this.refunds.execute(input, viewer);
  }
}
