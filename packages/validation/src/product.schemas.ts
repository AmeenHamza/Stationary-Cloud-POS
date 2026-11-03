import { z } from 'zod';

import {
  MAX_IDS_PER_LOOKUP,
  MAX_PIECES_PER_BOX,
  MAX_STOCK_CHANGE_PIECES,
  PRODUCT_SORTS,
  SALE_UNITS,
} from '@pos/contracts';

import {
  idempotencyKeySchema,
  idSchema,
  moneySchema,
  optionalMoneySchema,
  optionalText,
  percentSchema,
  requiredText,
  searchSchema,
  versionSchema,
} from './common.js';
import { pageArgsSchema } from './pagination.schemas.js';

/** Product fields shared by create and update (F-08, FEATURES.md §3.3). Stock is never edited here (BR-03). */
const productFields = {
  barcode: optionalText(64, 'Barcode'),
  name: requiredText(200, 'Name'),
  nameUrdu: optionalText(200, 'Urdu name'),
  categoryId: idSchema.nullish().transform((value) => value ?? null),
  baseUnitLabel: requiredText(20, 'Base unit'),
  piecesPerBox: z
    .int({ error: 'Pieces per box must be a whole number' })
    .min(1, { error: 'Pieces per box must be at least 1' })
    .max(MAX_PIECES_PER_BOX),
  salePrice: moneySchema,
  boxPrice: optionalMoneySchema,
  costPrice: optionalMoneySchema,
  taxRate: percentSchema,
  lowStockThreshold: z
    .int({ error: 'Threshold must be a whole number' })
    .min(0, { error: 'Threshold cannot be negative' })
    .max(MAX_STOCK_CHANGE_PIECES),
  lowStockThresholdUnit: z.enum(SALE_UNITS),
};

/** A box price needs boxes of more than one piece (D-17, A-08; also a database CHECK). */
const boxPriceRule = {
  check: (input: { boxPrice: string | null; piecesPerBox: number }) =>
    input.boxPrice === null || input.piecesPerBox > 1,
  params: { error: 'Set pieces per box above 1 to sell by the box', path: ['boxPrice'] },
};

const initialStockPieces = z
  .int({ error: 'Stock must be a whole number' })
  .min(0, { error: 'Stock cannot be negative' })
  .max(MAX_STOCK_CHANGE_PIECES);

/** `createProduct` [K]: an `OPENING` movement records `initialStockPieces` when above 0. */
export const createProductInputSchema = z
  .object({ idempotencyKey: idempotencyKeySchema, ...productFields, initialStockPieces })
  .refine(boxPriceRule.check, boxPriceRule.params);
export type CreateProductInput = z.output<typeof createProductInputSchema>;

/** `updateProduct` [V]. */
export const updateProductInputSchema = z
  .object({ id: idSchema, version: versionSchema, ...productFields })
  .refine(boxPriceRule.check, boxPriceRule.params);
export type UpdateProductInput = z.output<typeof updateProductInputSchema>;

/** `cloneProduct` [K]: one call per newly scanned barcode, copying every other attribute (D-19, BR-04). */
export const cloneProductInputSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  sourceProductId: idSchema,
  barcode: requiredText(64, 'Barcode'),
  initialStockPieces,
});
export type CloneProductInput = z.output<typeof cloneProductInputSchema>;

/** `products(filter, sort, first, after)` (API.md §6.1). */
export const productsArgsSchema = pageArgsSchema.extend({
  filter: z
    .object({
      search: searchSchema.nullish(),
      categoryId: idSchema.nullish(),
      uncategorised: z.boolean().nullish(),
      lowStockOnly: z.boolean().nullish(),
      includeArchived: z.boolean().nullish(),
    })
    .nullish(),
  sort: z.enum(PRODUCT_SORTS).default('NAME_ASC'),
});
export type ProductsArgs = z.output<typeof productsArgsSchema>;

/** `productsByIds(ids)`: at most 50 ids (bounded exception, API.md §3). */
export const productIdsSchema = z.array(idSchema).min(1).max(MAX_IDS_PER_LOOKUP);

/** `productByBarcode(barcode)`: exact match, trimmed. */
export const barcodeSchema = requiredText(64, 'Barcode');
