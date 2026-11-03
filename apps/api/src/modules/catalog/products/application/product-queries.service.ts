import { Injectable } from '@nestjs/common';

import { toConnection } from '../../../../common/pagination/keyset';
import {
  ProductListRepository,
  PRODUCT_SORT,
  productSortKey,
} from '../persistence/product-list.repository';
import { ProductsRepository } from '../persistence/products.repository';

import { toProductView, type ProductView } from './product-view';

import type { ConnectionValue } from '../../../../common/pagination/connection.factory';
import type { ProductFilter } from '../persistence/product-list.repository';
import type { PageArgs, ProductsArgs } from '@pos/validation';

/**
 * Product reads (API.md §6.1). Every list is a keyset page of at most 50; the total is a COUNT run
 * only when selected. Product data is never cached in Redis: billing and stock must read PostgreSQL.
 */
@Injectable()
export class ProductQueriesService {
  constructor(
    private readonly products: ProductsRepository,
    private readonly lists: ProductListRepository,
  ) {}

  list(args: ProductsArgs): Promise<ConnectionValue<ProductView>> {
    return this.page(args.filter ?? {}, PRODUCT_SORT[args.sort], args);
  }

  /** Active products at or below their threshold, emptiest first (F-13). */
  lowStock(args: PageArgs): Promise<ConnectionValue<ProductView>> {
    return this.page({ lowStockOnly: true }, PRODUCT_SORT.STOCK_ASC, args);
  }

  /** One COUNT over the partial low-stock index (NETWORK_OPTIMIZATION.md H2). */
  lowStockCount(): Promise<number> {
    return this.lists.count({ lowStockOnly: true });
  }

  async byId(id: string): Promise<ProductView | null> {
    const row = await this.products.findById(id);
    return row && toProductView(row);
  }

  async byBarcode(barcode: string): Promise<ProductView | null> {
    const row = await this.products.findActiveByBarcode(barcode);
    return row && toProductView(row);
  }

  async byIds(ids: readonly string[]): Promise<ProductView[]> {
    const rows = await this.products.findByIds(ids);
    return rows.map(toProductView);
  }

  private async page(
    filter: ProductFilter,
    sort: (typeof PRODUCT_SORT)[keyof typeof PRODUCT_SORT],
    args: PageArgs,
  ): Promise<ConnectionValue<ProductView>> {
    const rows = await this.lists.list(filter, sort, args.first + 1, args.after);
    const connection = toConnection(
      rows,
      args.first,
      sort,
      (row) => productSortKey(sort, row),
      () => this.lists.count(filter),
    );
    return { ...connection, nodes: connection.nodes.map(toProductView) };
  }
}
