import { isLowStock } from '@pos/domain';

import type { DecimalLike } from '../../../../common/graphql/scalars';
import type { ProductRow } from '../persistence/products.repository';
import type { SaleUnit } from '@pos/contracts';

/** What the Product GraphQL type renders. */
export interface ProductView {
  id: string;
  barcode: string | null;
  name: string;
  nameUrdu: string | null;
  categoryId: string | null;
  categoryName: string | null;
  baseUnitLabel: string;
  piecesPerBox: number;
  salePrice: DecimalLike;
  boxPrice: DecimalLike | null;
  costPrice: DecimalLike | null;
  taxRate: DecimalLike;
  lowStockThresholdPieces: number;
  lowStockThresholdUnit: SaleUnit;
  stockPieces: number;
  isLowStock: boolean;
  archivedAt: Date | null;
  version: number;
}

/** Archived products are never "low stock": they are off the shelf (DATABASE.md §4.5 index predicate). */
export function lowStockOf(row: {
  archivedAt: Date | null;
  stockPieces: number;
  lowStockThresholdPieces: number;
}): boolean {
  return row.archivedAt === null && isLowStock(row.stockPieces, row.lowStockThresholdPieces);
}

export function toProductView(row: ProductRow): ProductView {
  const { category, ...fields } = row;
  return { ...fields, categoryName: category?.name ?? null, isLowStock: lowStockOf(row) };
}
