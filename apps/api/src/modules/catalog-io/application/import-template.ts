import ExcelJS from 'exceljs';

import { IMPORT_COLUMNS } from '@pos/validation';

import type { Writable } from 'node:stream';

/** One illustrative row: a box of 12 pens (made-up values, no real product or person). */
const EXAMPLE: Readonly<Record<(typeof IMPORT_COLUMNS)[number]['field'], string | number>> = {
  barcode: '8960000000000',
  name: 'Ball pen, blue',
  nameUrdu: '',
  categoryName: '',
  baseUnitLabel: 'Piece',
  piecesPerBox: 12,
  salePrice: '30.00',
  boxPrice: '330.00',
  costPrice: '25.00',
  taxRate: '0',
  lowStockThreshold: 5,
  lowStockThresholdUnit: 'PIECE',
  openingStock: 120,
};

/**
 * The import template (F-11, Q14): the headers the parser expects and one example row. Blank
 * Category means Uncategorised; a category that does not exist fails its row (Q37).
 */
export async function writeTemplate(out: Writable): Promise<void> {
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: out, useStyles: false });
  const sheet = workbook.addWorksheet('Products');
  sheet.columns = IMPORT_COLUMNS.map((column) => ({ header: column.header, width: 16 }));
  sheet.addRow(IMPORT_COLUMNS.map((column) => EXAMPLE[column.field])).commit();
  sheet.commit();
  await workbook.commit();
}
