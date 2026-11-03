import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import * as schemas from '@pos/validation';

import { RequirePermission } from '../../../../common/auth/access-policy';
import { CurrentViewer } from '../../../../common/auth/current-viewer.decorator';
import { ZodValidationPipe } from '../../../../common/validation/zod-validation.pipe';
import { CategoryCommandsService } from '../application/category-commands.service';
import { CategoryQueriesService, type CategoryView } from '../application/category-queries.service';

import * as inputs from './category.inputs';
import { Category, CategoryConnection } from './category.type';

import type { Principal } from '../../../../common/auth/principal';
import type { ConnectionValue } from '../../../../common/pagination/connection.factory';

/** Categories (F-12, API.md §6): every role reads; admins change them. */
@Resolver(() => Category)
export class CategoryResolver {
  constructor(
    private readonly queries: CategoryQueriesService,
    private readonly commands: CategoryCommandsService,
  ) {}

  @Query(() => CategoryConnection)
  @RequirePermission('catalog:read')
  categories(
    // The pipe returns the parsed arguments (defaults applied, search trimmed).
    @Args(new ZodValidationPipe(schemas.categoriesArgsSchema)) args: inputs.CategoriesArgs,
  ): Promise<ConnectionValue<CategoryView>> {
    return this.queries.list(args);
  }

  @Query(() => Category, { nullable: true })
  @RequirePermission('catalog:read')
  category(
    @Args('id', { type: () => ID }, new ZodValidationPipe(schemas.idSchema)) id: string,
  ): Promise<CategoryView | null> {
    return this.queries.byId(id);
  }

  @Mutation(() => Category)
  @RequirePermission('catalog:write')
  createCategory(
    @Args(
      'input',
      { type: () => inputs.CreateCategoryInput },
      new ZodValidationPipe(schemas.createCategoryInputSchema),
    )
    input: schemas.CreateCategoryInput,
    @CurrentViewer() viewer: Principal,
  ): Promise<CategoryView> {
    return this.commands.create(input, viewer);
  }

  @Mutation(() => Category)
  @RequirePermission('catalog:write')
  updateCategory(
    @Args(
      'input',
      { type: () => inputs.UpdateCategoryInput },
      new ZodValidationPipe(schemas.updateCategoryInputSchema),
    )
    input: schemas.UpdateCategoryInput,
    @CurrentViewer() viewer: Principal,
  ): Promise<CategoryView> {
    return this.commands.update(input, viewer);
  }

  @Mutation(() => Boolean, { description: 'Moves its products to Uncategorised (Q16b).' })
  @RequirePermission('catalog:write')
  deleteCategory(
    @Args('id', { type: () => ID }, new ZodValidationPipe(schemas.idSchema)) id: string,
    @CurrentViewer() viewer: Principal,
  ): Promise<boolean> {
    return this.commands.delete(id, viewer);
  }
}
