import { Field, GraphQLISODateTime, ID, Int, ObjectType } from '@nestjs/graphql';

import { requireFieldPermission } from '../../../../common/auth/field-permission';
import { SaleUnitEnum } from '../../../../common/graphql/enums.registry';
import { MoneyScalar, PercentScalar, type DecimalLike } from '../../../../common/graphql/scalars';
import { Connection } from '../../../../common/pagination/connection.factory';

import type { SaleUnit } from '@pos/contracts';

/** Public product fields, shared by `Product` and the event `ProductSnapshot` (no cost price). */
@ObjectType({ isAbstract: true })
export abstract class ProductFields {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { nullable: true })
  barcode!: string | null;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  nameUrdu!: string | null;

  @Field(() => ID, { nullable: true, description: 'Null means Uncategorised.' })
  categoryId!: string | null;

  @Field(() => String)
  baseUnitLabel!: string;

  @Field(() => Int)
  piecesPerBox!: number;

  @Field(() => MoneyScalar, { description: 'Per piece, before product tax (D-07).' })
  salePrice!: DecimalLike;

  @Field(() => MoneyScalar, {
    nullable: true,
    description: 'Set only when sold by the box (D-17).',
  })
  boxPrice!: DecimalLike | null;

  @Field(() => PercentScalar)
  taxRate!: DecimalLike;

  @Field(() => Int)
  lowStockThresholdPieces!: number;

  @Field(() => SaleUnitEnum, { description: 'Unit the threshold was entered in (display only).' })
  lowStockThresholdUnit!: SaleUnit;

  @Field(() => Int, { description: 'May be negative after selling above stock (D-16).' })
  stockPieces!: number;

  @Field(() => Boolean)
  isLowStock!: boolean;

  @Field(() => GraphQLISODateTime, { nullable: true })
  archivedAt!: Date | null;

  @Field(() => Int)
  version!: number;
}

/** A catalogue product (F-08). `costPrice` is visible to admins only (SEC-03). */
@ObjectType('Product')
export class Product extends ProductFields {
  @Field(() => String, { nullable: true })
  categoryName!: string | null;

  @Field(() => MoneyScalar, {
    nullable: true,
    middleware: [requireFieldPermission('catalog:write')],
  })
  costPrice!: DecimalLike | null;
}

@ObjectType('ProductConnection')
export class ProductConnection extends Connection(Product) {}

/** The product as sent in `product.changed` events (API.md §7.2). */
@ObjectType('ProductSnapshot')
export class ProductSnapshot extends ProductFields {}
