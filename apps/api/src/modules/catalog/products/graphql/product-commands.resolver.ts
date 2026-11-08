import { Args, ID, Mutation, Resolver } from '@nestjs/graphql';

import * as schemas from '@pos/validation';

import { RequirePermission } from '../../../../common/auth/access-policy';
import { CurrentViewer } from '../../../../common/auth/current-viewer.decorator';
import { ZodValidationPipe } from '../../../../common/validation/zod-validation.pipe';
import { ArchiveProductService } from '../application/archive-product.service';
import { CloneProductService } from '../application/clone-product.service';
import { CreateProductService } from '../application/create-product.service';
import { DeleteProductService } from '../application/delete-product.service';
import { UpdateProductService } from '../application/update-product.service';

import * as inputs from './product.inputs';
import { Product } from './product.type';

import type { Principal } from '../../../../common/auth/principal';
import type { ProductView } from '../application/product-view';

/** Product commands for admins (F-08, F-09, API.md §6.2). */
@Resolver(() => Product)
@RequirePermission('catalog:write')
export class ProductCommandsResolver {
  constructor(
    private readonly creator: CreateProductService,
    private readonly updater: UpdateProductService,
    private readonly cloner: CloneProductService,
    private readonly archiver: ArchiveProductService,
    private readonly deleter: DeleteProductService,
  ) {}

  @Mutation(() => Product)
  createProduct(
    @Args(
      'input',
      { type: () => inputs.CreateProductInput },
      new ZodValidationPipe(schemas.createProductInputSchema),
    )
    input: schemas.CreateProductInput,
    @CurrentViewer() viewer: Principal,
  ): Promise<ProductView> {
    return this.creator.execute(input, viewer);
  }

  @Mutation(() => Product)
  updateProduct(
    @Args(
      'input',
      { type: () => inputs.UpdateProductInput },
      new ZodValidationPipe(schemas.updateProductInputSchema),
    )
    input: schemas.UpdateProductInput,
    @CurrentViewer() viewer: Principal,
  ): Promise<ProductView> {
    return this.updater.execute(input, viewer);
  }

  @Mutation(() => Product)
  cloneProduct(
    @Args(
      'input',
      { type: () => inputs.CloneProductInput },
      new ZodValidationPipe(schemas.cloneProductInputSchema),
    )
    input: schemas.CloneProductInput,
    @CurrentViewer() viewer: Principal,
  ): Promise<ProductView> {
    return this.cloner.execute(input, viewer);
  }

  @Mutation(() => Product)
  archiveProduct(
    @Args('id', { type: () => ID }, new ZodValidationPipe(schemas.idSchema)) id: string,
    @CurrentViewer() viewer: Principal,
  ): Promise<ProductView> {
    return this.archiver.archive(id, viewer);
  }

  @Mutation(() => Product)
  restoreProduct(
    @Args('id', { type: () => ID }, new ZodValidationPipe(schemas.idSchema)) id: string,
    @CurrentViewer() viewer: Principal,
  ): Promise<ProductView> {
    return this.archiver.restore(id, viewer);
  }

  @Mutation(() => Boolean, { description: 'Only if no bill sold it (HAS_HISTORY, D-28).' })
  deleteProduct(
    @Args('id', { type: () => ID }, new ZodValidationPipe(schemas.idSchema)) id: string,
    @CurrentViewer() viewer: Principal,
  ): Promise<boolean> {
    return this.deleter.execute(id, viewer);
  }
}
