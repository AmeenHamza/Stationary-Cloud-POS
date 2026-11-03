import { Args, ID, Int, Query, Resolver } from '@nestjs/graphql';

import * as schemas from '@pos/validation';

import { RequirePermission } from '../../../../common/auth/access-policy';
import { PageArgs } from '../../../../common/pagination/page.args';
import { ZodValidationPipe } from '../../../../common/validation/zod-validation.pipe';
import { ProductQueriesService } from '../application/product-queries.service';

import { ProductsArgs } from './product.inputs';
import { Product, ProductConnection } from './product.type';

import type { ConnectionValue } from '../../../../common/pagination/connection.factory';
import type { ProductView } from '../application/product-view';

/** Product reads for every role (API.md §6.1); `costPrice` is masked per field (SEC-03). */
@Resolver(() => Product)
@RequirePermission('catalog:read')
export class ProductQueriesResolver {
  constructor(private readonly queries: ProductQueriesService) {}

  @Query(() => ProductConnection)
  products(
    // The pipe returns the parsed arguments (defaults applied, search trimmed).
    @Args(new ZodValidationPipe(schemas.productsArgsSchema)) args: ProductsArgs,
  ): Promise<ConnectionValue<ProductView>> {
    return this.queries.list(args);
  }

  @Query(() => Product, { nullable: true })
  product(
    @Args('id', { type: () => ID }, new ZodValidationPipe(schemas.idSchema)) id: string,
  ): Promise<ProductView | null> {
    return this.queries.byId(id);
  }

  @Query(() => Product, { nullable: true, description: 'Exact barcode, active products only.' })
  productByBarcode(
    @Args('barcode', { type: () => String }, new ZodValidationPipe(schemas.barcodeSchema))
    barcode: string,
  ): Promise<ProductView | null> {
    return this.queries.byBarcode(barcode);
  }

  @Query(() => [Product], { description: 'At most 50 ids: cart and visible-row reconciliation.' })
  productsByIds(
    @Args('ids', { type: () => [ID] }, new ZodValidationPipe(schemas.productIdsSchema))
    ids: string[],
  ): Promise<ProductView[]> {
    return this.queries.byIds(ids);
  }

  @Query(() => ProductConnection, { description: 'Active products at or below their threshold.' })
  lowStockProducts(
    @Args(new ZodValidationPipe(schemas.pageArgsSchema)) args: PageArgs,
  ): Promise<ConnectionValue<ProductView>> {
    return this.queries.lowStock(args);
  }

  @Query(() => Int)
  lowStockCount(): Promise<number> {
    return this.queries.lowStockCount();
  }
}
