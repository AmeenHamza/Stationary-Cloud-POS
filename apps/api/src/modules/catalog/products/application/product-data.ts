import { normalizeNameKey, thresholdToPieces } from '@pos/domain';

import { AppError } from '../../../../common/errors/app-error';
import { isUniqueViolation } from '../../../../common/errors/prisma-error.mapper';

import type { ProductRow } from '../persistence/products.repository';
import type { UpdateProductInput } from '@pos/validation';

export type ProductFieldsInput = Omit<UpdateProductInput, 'id' | 'version'>;

/** Columns from validated input: the sort/search key and the threshold in pieces (BR-01). */
export function productData(fields: ProductFieldsInput) {
  const { lowStockThreshold, ...rest } = fields;
  return {
    ...rest,
    nameKey: normalizeNameKey(fields.name),
    lowStockThresholdPieces: thresholdToPieces(
      lowStockThreshold,
      fields.lowStockThresholdUnit,
      fields.piecesPerBox,
    ),
  };
}

/** Every attribute a clone copies from its source: everything except barcode and stock (BR-04). */
export function cloneData(source: ProductRow) {
  return {
    name: source.name,
    nameKey: normalizeNameKey(source.name),
    nameUrdu: source.nameUrdu,
    categoryId: source.categoryId,
    baseUnitLabel: source.baseUnitLabel,
    piecesPerBox: source.piecesPerBox,
    salePrice: source.salePrice,
    boxPrice: source.boxPrice,
    costPrice: source.costPrice,
    taxRate: source.taxRate,
    lowStockThresholdPieces: source.lowStockThresholdPieces,
    lowStockThresholdUnit: source.lowStockThresholdUnit,
    clonedFromId: source.id,
  };
}

/** Database refusals that are the user's to fix, shown on the right field (API.md §4). */
export async function mapProductWriteErrors<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    if (isUniqueViolation(error, 'barcode')) {
      throw new AppError('CONFLICT', 'Some fields are invalid.', {
        fieldErrors: { barcode: 'Another active product already uses this barcode' },
      });
    }
    if (code === 'P2003') {
      throw new AppError('BAD_USER_INPUT', 'Some fields are invalid.', {
        fieldErrors: { categoryId: 'Choose an existing category' },
      });
    }
    if (code === 'P2025') {
      throw new AppError('CONFLICT', 'Someone else changed this product. Reload and try again.');
    }
    throw error;
  }
}
