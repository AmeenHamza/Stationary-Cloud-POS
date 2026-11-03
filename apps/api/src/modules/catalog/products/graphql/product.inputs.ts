import { ArgsType, Field, ID, InputType, Int } from '@nestjs/graphql';

import { ProductSortEnum, SaleUnitEnum } from '../../../../common/graphql/enums.registry';
import { MoneyScalar, PercentScalar } from '../../../../common/graphql/scalars';
import { PageArgs } from '../../../../common/pagination/page.args';

import type { ProductSort, SaleUnit } from '@pos/contracts';

/** Shapes only; validation is in `@pos/validation` (product.schemas.ts). */
@InputType()
export class ProductFilter {
  @Field(() => String, { nullable: true })
  search?: string | null;

  @Field(() => ID, { nullable: true })
  categoryId?: string | null;

  @Field(() => Boolean, { nullable: true })
  uncategorised?: boolean | null;

  @Field(() => Boolean, { nullable: true })
  lowStockOnly?: boolean | null;

  @Field(() => Boolean, { nullable: true })
  includeArchived?: boolean | null;
}

@ArgsType()
export class ProductsArgs extends PageArgs {
  @Field(() => ProductFilter, { nullable: true })
  filter?: ProductFilter | null;

  @Field(() => ProductSortEnum, { defaultValue: 'NAME_ASC' })
  sort: ProductSort = 'NAME_ASC';
}

/** Fields shared by create and update (F-08). Stock is not one of them (BR-03). */
@InputType({ isAbstract: true })
abstract class ProductFieldsInput {
  @Field(() => String, { nullable: true })
  barcode?: string | null;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  nameUrdu?: string | null;

  @Field(() => ID, { nullable: true })
  categoryId?: string | null;

  @Field(() => String)
  baseUnitLabel!: string;

  @Field(() => Int)
  piecesPerBox!: number;

  @Field(() => MoneyScalar)
  salePrice!: string;

  @Field(() => MoneyScalar, { nullable: true })
  boxPrice?: string | null;

  @Field(() => MoneyScalar, { nullable: true })
  costPrice?: string | null;

  @Field(() => PercentScalar)
  taxRate!: string;

  @Field(() => Int, { description: 'In `lowStockThresholdUnit`; stored in pieces (BR-01).' })
  lowStockThreshold!: number;

  @Field(() => SaleUnitEnum)
  lowStockThresholdUnit!: SaleUnit;
}

@InputType()
export class CreateProductInput extends ProductFieldsInput {
  @Field(() => ID)
  idempotencyKey!: string;

  @Field(() => Int)
  initialStockPieces!: number;
}

@InputType()
export class UpdateProductInput extends ProductFieldsInput {
  @Field(() => ID)
  id!: string;

  @Field(() => Int)
  version!: number;
}

@InputType()
export class CloneProductInput {
  @Field(() => ID)
  idempotencyKey!: string;

  @Field(() => ID)
  sourceProductId!: string;

  @Field(() => String)
  barcode!: string;

  @Field(() => Int)
  initialStockPieces!: number;
}
