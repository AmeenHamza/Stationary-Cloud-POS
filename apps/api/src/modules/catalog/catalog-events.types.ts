import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

import { CategoryChangeEnum, ProductChangeEnum } from '../../common/graphql/enums.registry';
import { ShopEvent } from '../../common/graphql/shop-event.interface';

import { CategorySnapshot } from './categories/graphql/category.type';
import { ProductSnapshot } from './products/graphql/product.type';

import type { CategoryChange, ProductChange } from '@pos/contracts';

/** One product's stock after a change. */
@ObjectType('StockLevel')
export class StockLevel {
  @Field(() => ID)
  productId!: string;

  @Field(() => Int)
  stockPieces!: number;

  @Field(() => Boolean)
  isLowStock!: boolean;

  @Field(() => Int)
  version!: number;
}

/** `stock.changed`: clients patch cached products when `version` is newer (API.md §7.2). */
@ObjectType('StockChangedEvent', { implements: () => [ShopEvent] })
export class StockChangedEvent extends ShopEvent {
  @Field(() => [StockLevel], { description: 'At most 100: one transaction’s lines.' })
  items!: StockLevel[];
}

/** `product.changed`. `product` is null when the snapshot would exceed 1 KB: clients refetch it. */
@ObjectType('ProductChangedEvent', { implements: () => [ShopEvent] })
export class ProductChangedEvent extends ShopEvent {
  @Field(() => ProductChangeEnum)
  change!: ProductChange;

  @Field(() => ID)
  productId!: string;

  @Field(() => Int)
  version!: number;

  @Field(() => ProductSnapshot, { nullable: true })
  product!: ProductSnapshot | null;
}

/** `category.changed`: names and counts; `category` is null when deleted. */
@ObjectType('CategoryChangedEvent', { implements: () => [ShopEvent] })
export class CategoryChangedEvent extends ShopEvent {
  @Field(() => CategoryChangeEnum)
  change!: CategoryChange;

  @Field(() => ID)
  categoryId!: string;

  @Field(() => CategorySnapshot, { nullable: true })
  category!: CategorySnapshot | null;
}

/** `lowStock.countChanged` (admins): a signal to refetch the badge and the low-stock page. */
@ObjectType('LowStockCountChangedEvent', { implements: () => [ShopEvent] })
export class LowStockCountChangedEvent extends ShopEvent {
  @Field(() => [ID])
  crossedProductIds!: string[];
}
