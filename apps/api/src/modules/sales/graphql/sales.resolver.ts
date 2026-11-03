import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import * as schemas from '@pos/validation';

import { RequirePermission } from '../../../common/auth/access-policy';
import { CurrentViewer } from '../../../common/auth/current-viewer.decorator';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { CreateSaleService } from '../application/create-sale.service';
import { OrderQueriesService } from '../application/order-queries.service';

import { Order } from './order.types';
import { CreateSalePayload } from './receipt.types';
import * as inputs from './sale.inputs';

import type { Principal } from '../../../common/auth/principal';

/** Billing (F-19–F-22, API.md §6): cashiers and admins sell; discounts need `sales:discount`. */
@Resolver(() => Order)
@RequirePermission('sales:create')
export class SalesResolver {
  constructor(
    private readonly sales: CreateSaleService,
    private readonly queries: OrderQueriesService,
  ) {}

  @Mutation(() => CreateSalePayload)
  createSale(
    @Args(
      'input',
      { type: () => inputs.CreateSaleInput },
      new ZodValidationPipe(schemas.createSaleInputSchema),
    )
    input: schemas.CreateSaleInput,
    @CurrentViewer() viewer: Principal,
  ): Promise<CreateSalePayload> {
    return this.sales.execute(input, viewer);
  }

  @Query(() => Order, {
    nullable: true,
    description: 'Confirms a sale whose response was lost: the bill, or null (SYSTEM_DESIGN §3.4).',
  })
  saleStatus(
    @Args('idempotencyKey', { type: () => ID }, new ZodValidationPipe(schemas.idempotencyKeySchema))
    idempotencyKey: string,
  ): Promise<Order | null> {
    return this.queries.saleStatus(idempotencyKey);
  }
}
