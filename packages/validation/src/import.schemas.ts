import { z } from 'zod';

import {
  EXPORT_FORMATS,
  IMPORT_ROW_STATUSES,
  MAX_PIECES_PER_BOX,
  MAX_STOCK_CHANGE_PIECES,
  SALE_UNITS,
} from '@pos/contracts';

import {
  idSchema,
  moneySchema,
  optionalMoneySchema,
  optionalText,
  percentSchema,
  requiredText,
} from './common.js';
import { pageArgsSchema } from './pagination.schemas.js';

/**
 * The product import template (F-11, Q14, Q37): header → field. The first row of an upload must
 * hold these headers (any order, case-insensitive); unknown columns are ignored.
 */
export const IMPORT_COLUMNS = [
  { header: 'Barcode', field: 'barcode' },
  { header: 'Name', field: 'name' },
  { header: 'Urdu name', field: 'nameUrdu' },
  { header: 'Category', field: 'categoryName' },
  { header: 'Base unit', field: 'baseUnitLabel' },
  { header: 'Pieces per box', field: 'piecesPerBox' },
  { header: 'Sale price', field: 'salePrice' },
  { header: 'Box price', field: 'boxPrice' },
  { header: 'Cost price', field: 'costPrice' },
  { header: 'Tax rate %', field: 'taxRate' },
  { header: 'Low stock threshold', field: 'lowStockThreshold' },
  { header: 'Threshold unit', field: 'lowStockThresholdUnit' },
  { header: 'Opening stock', field: 'openingStock' },
] as const;

/** A blank cell is "not given". */
const blank = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/** A whole number written as text ("12"), within `[min, max]`; `fallback` when blank. */
const wholeNumber = (label: string, min: number, max: number, fallback: number) =>
  z.preprocess(
    (value) => {
      const given = blank(value);
      if (given === undefined) return fallback;
      return typeof given === 'string' && /^-?\d+$/.test(given.trim())
        ? Number.parseInt(given, 10)
        : given;
    },
    z
      .int({ error: `${label} must be a whole number` })
      .min(min, { error: `${label} must be at least ${String(min)}` })
      .max(max, { error: `${label} is too large` }),
  );

/**
 * One spreadsheet row (cells as trimmed text). Defaults for blank optional cells: base unit
 * "Piece", 1 piece per box, 0 % tax (Q32), threshold 0 in pieces, opening stock 0.
 */
export const productImportRowSchema = z
  .object({
    barcode: z.preprocess(blank, optionalText(64, 'Barcode')),
    name: requiredText(200, 'Name'),
    nameUrdu: z.preprocess(blank, optionalText(200, 'Urdu name')),
    categoryName: z.preprocess(blank, optionalText(60, 'Category')),
    baseUnitLabel: z.preprocess((v) => blank(v) ?? 'Piece', requiredText(20, 'Base unit')),
    piecesPerBox: wholeNumber('Pieces per box', 1, MAX_PIECES_PER_BOX, 1),
    salePrice: moneySchema,
    boxPrice: z.preprocess(blank, optionalMoneySchema),
    costPrice: z.preprocess(blank, optionalMoneySchema),
    taxRate: z.preprocess((v) => blank(v) ?? '0', percentSchema),
    lowStockThreshold: wholeNumber('Low stock threshold', 0, MAX_STOCK_CHANGE_PIECES, 0),
    lowStockThresholdUnit: z.preprocess(
      (v) => (typeof blank(v) === 'string' ? String(v).trim().toUpperCase() : 'PIECE'),
      z.enum(SALE_UNITS, { error: 'Threshold unit must be PIECE or BOX' }),
    ),
    openingStock: wholeNumber('Opening stock', 0, MAX_STOCK_CHANGE_PIECES, 0),
  })
  .refine((row) => row.boxPrice === null || row.piecesPerBox > 1, {
    error: 'Set pieces per box above 1 to sell by the box',
    path: ['boxPrice'],
  });
export type ProductImportRow = z.output<typeof productImportRowSchema>;

/** `GET /v1/exports/products?format=&categoryId=&includeArchived=` (API.md §9). */
export const productExportQuerySchema = z.object({
  format: z.enum(EXPORT_FORMATS),
  categoryId: idSchema.optional(),
  includeArchived: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});
export type ProductExportQuery = z.output<typeof productExportQuerySchema>;

/** `GET /v1/exports/low-stock?format=csv|pdf`. */
export const lowStockExportQuerySchema = z.object({ format: z.enum(['csv', 'pdf']) });

/** `importJobRows(jobId, status, first, after)`. */
export const importJobRowsArgsSchema = pageArgsSchema.extend({
  jobId: idSchema,
  status: z.enum(IMPORT_ROW_STATUSES).nullish(),
});
export type ImportJobRowsArgs = z.output<typeof importJobRowsArgsSchema>;
