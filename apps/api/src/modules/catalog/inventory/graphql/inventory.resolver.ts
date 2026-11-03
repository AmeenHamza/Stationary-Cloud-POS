import { Args, Mutation, Resolver } from '@nestjs/graphql';

import * as schemas from '@pos/validation';

import { RequirePermission } from '../../../../common/auth/access-policy';
import { CurrentViewer } from '../../../../common/auth/current-viewer.decorator';
import { ZodValidationPipe } from '../../../../common/validation/zod-validation.pipe';
import { Product } from '../../products/graphql/product.type';
import { AdjustStockService } from '../application/adjust-stock.service';
import { RestockService } from '../application/restock.service';

import * as inputs from './inventory.inputs';

import type { Principal } from '../../../../common/auth/principal';
import type { ProductView } from '../../products/application/product-view';

/** Stock changes outside billing (F-10, D-18): each returns the product with its new stock. */
@Resolver(() => Product)
export class InventoryResolver {
  constructor(
    private readonly restocker: RestockService,
    private readonly adjuster: AdjustStockService,
  ) {}

  @Mutation(() => Product)
  @RequirePermission('inventory:restock')
  restockProduct(
    @Args(
      'input',
      { type: () => inputs.RestockInput },
      new ZodValidationPipe(schemas.restockInputSchema),
    )
    input: schemas.RestockInput,
    @CurrentViewer() viewer: Principal,
  ): Promise<ProductView> {
    return this.restocker.execute(input, viewer);
  }

  @Mutation(() => Product)
  @RequirePermission('inventory:adjust')
  adjustStock(
    @Args(
      'input',
      { type: () => inputs.AdjustStockInput },
      new ZodValidationPipe(schemas.adjustStockInputSchema),
    )
    input: schemas.AdjustStockInput,
    @CurrentViewer() viewer: Principal,
  ): Promise<ProductView> {
    return this.adjuster.execute(input, viewer);
  }
}
