import { Injectable } from '@nestjs/common';

import { encodeCursor } from '../../../../common/pagination/cursor.codec';
import { toProductView, type ProductView } from '../application/product-view';

import {
  PRODUCT_SORT,
  ProductListRepository,
  productSortKey,
  type ProductFilter,
} from './product-list.repository';

/** Rows per database read while exporting (API.md §9). */
export const EXPORT_BATCH_SIZE = 500;

/**
 * Products for file exports (F-11, F-13), read in keyset batches so memory stays bounded however
 * large the catalogue is (ADR-020). Exports are the only whole-table reads, and they are explicit,
 * admin-only downloads.
 */
@Injectable()
export class ProductExportReader {
  constructor(private readonly list: ProductListRepository) {}

  /** Name order; the low-stock export uses stock order, like the low-stock screen. */
  async *batches(filter: ProductFilter, size = EXPORT_BATCH_SIZE): AsyncGenerator<ProductView[]> {
    const sort = filter.lowStockOnly === true ? PRODUCT_SORT.STOCK_ASC : PRODUCT_SORT.NAME_ASC;
    let after: string | null = null;
    for (;;) {
      const rows = await this.list.list(filter, sort, size, after);
      if (rows.length > 0) {
        yield rows.map(toProductView);
      }
      const last = rows.at(-1);
      if (last === undefined || rows.length < size) {
        return;
      }
      after = encodeCursor(sort.name, productSortKey(sort, last), last.id);
    }
  }
}
