import { Injectable } from '@nestjs/common';

import { SEARCH_MIN_CHARS, type ProductSort } from '@pos/contracts';
import { normalizeNameKey } from '@pos/domain';

import { keysetOrderBy, keysetWhere, type KeysetSort } from '../../../../common/pagination/keyset';
import { TransactionalClient } from '../../../../infrastructure/prisma/transactional-client';

import { PRODUCT_SELECT, type ProductRow } from './products.repository';

import type { CursorKey } from '../../../../common/pagination/cursor.codec';
import type { Prisma } from '@pos/database';

export interface ProductFilter {
  search?: string | null | undefined;
  categoryId?: string | null | undefined;
  uncategorised?: boolean | null | undefined;
  lowStockOnly?: boolean | null | undefined;
  includeArchived?: boolean | null | undefined;
}

/** Fixed sorts (API.md §3), each with `id` as the tiebreaker and an index in DATABASE.md §4.5. */
export const PRODUCT_SORT: Readonly<Record<ProductSort | 'STOCK_ASC', KeysetSort>> = {
  NAME_ASC: { name: 'NAME_ASC', field: 'nameKey', direction: 'asc' },
  NAME_DESC: { name: 'NAME_DESC', field: 'nameKey', direction: 'desc' },
  PRICE_ASC: { name: 'PRICE_ASC', field: 'salePrice', direction: 'asc' },
  PRICE_DESC: { name: 'PRICE_DESC', field: 'salePrice', direction: 'desc' },
  STOCK_ASC: { name: 'STOCK_ASC', field: 'stockPieces', direction: 'asc' },
};

/** The sort column's value for a row, as stored in the cursor. */
export function productSortKey(
  sort: KeysetSort,
  row: ProductRow & { nameKey?: string },
): CursorKey {
  if (sort.field === 'salePrice') {
    return row.salePrice.toString();
  }
  if (sort.field === 'stockPieces') {
    return row.stockPieces;
  }
  return row.nameKey ?? normalizeNameKey(row.name);
}

/**
 * Product lists (DATABASE.md §5): keyset pages of `first + 1`, server-side search on name, Urdu name
 * and exact barcode (a 1-character term matches barcodes only), and the low-stock rule as a column
 * comparison so `products_low_stock_idx` serves it.
 */
@Injectable()
export class ProductListRepository {
  constructor(private readonly db: TransactionalClient) {}

  list(filter: ProductFilter, sort: KeysetSort, take: number, after: string | null | undefined) {
    const cursor = keysetWhere(sort, after) as Prisma.ProductWhereInput | undefined;
    return this.db.client.product.findMany({
      where: { AND: [this.where(filter), ...(cursor === undefined ? [] : [cursor])] },
      orderBy: keysetOrderBy(sort),
      take,
      select: { ...PRODUCT_SELECT, nameKey: true },
    });
  }

  count(filter: ProductFilter): Promise<number> {
    return this.db.client.product.count({ where: this.where(filter) });
  }

  private where(filter: ProductFilter): Prisma.ProductWhereInput {
    const fields = this.db.client.product.fields;
    return {
      ...(filter.includeArchived === true ? {} : { archivedAt: null }),
      ...(filter.categoryId == null ? {} : { categoryId: filter.categoryId }),
      ...(filter.uncategorised === true ? { categoryId: null } : {}),
      ...(filter.lowStockOnly === true
        ? { stockPieces: { lte: fields.lowStockThresholdPieces } }
        : {}),
      ...(filter.search == null ? {} : { OR: searchTerms(filter.search) }),
    };
  }
}

function searchTerms(search: string): Prisma.ProductWhereInput[] {
  const barcode: Prisma.ProductWhereInput = { barcode: search };
  if (search.length < SEARCH_MIN_CHARS) {
    return [barcode];
  }
  return [
    barcode,
    { nameKey: { contains: normalizeNameKey(search) } },
    { nameUrdu: { contains: search } },
  ];
}
