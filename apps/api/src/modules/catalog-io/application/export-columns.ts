import { piecesToThreshold } from '@pos/domain';

import { moneyText } from '../../../common/graphql/scalars';

import type { ProductView } from '../../catalog';

export type Cell = string | number | null;

export interface ExportColumn {
  header: string;
  /** Relative width (characters) for XLSX and PDF. */
  width: number;
  /** Shown in the PDF too (the PDF has no room for every column, nor Urdu glyphs). */
  inPdf: boolean;
  /** Printed as "Rs 1,234.50" in the PDF, like the screens (plain decimals in CSV and XLSX). */
  isMoney?: true;
  value: (product: ProductView) => Cell;
}

/**
 * A text cell a spreadsheet must never run as a formula (SEC-14, OWASP CSV injection): cells
 * starting with = + - @, tab or carriage return get a leading apostrophe.
 */
export function safeText(value: string | null): string | null {
  return value !== null && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

const money = (value: { toString: () => string } | null): string | null =>
  value === null ? null : moneyText(value);

/**
 * The product export uses the import template's headers, so an edited export imports again: its
 * Category column names each product's category, and an import creates any that is missing (D-29).
 */
export const PRODUCT_COLUMNS: readonly ExportColumn[] = [
  { header: 'Barcode', width: 16, inPdf: true, value: (p) => safeText(p.barcode) },
  { header: 'Name', width: 36, inPdf: true, value: (p) => safeText(p.name) },
  { header: 'Urdu name', width: 24, inPdf: false, value: (p) => safeText(p.nameUrdu) },
  { header: 'Category', width: 18, inPdf: true, value: (p) => safeText(p.categoryName) },
  { header: 'Base unit', width: 10, inPdf: false, value: (p) => safeText(p.baseUnitLabel) },
  { header: 'Pieces per box', width: 8, inPdf: false, value: (p) => p.piecesPerBox },
  { header: 'Sale price', width: 12, inPdf: true, isMoney: true, value: (p) => money(p.salePrice) },
  { header: 'Box price', width: 12, inPdf: true, isMoney: true, value: (p) => money(p.boxPrice) },
  { header: 'Cost price', width: 12, inPdf: true, isMoney: true, value: (p) => money(p.costPrice) },
  { header: 'Tax rate %', width: 8, inPdf: false, value: (p) => money(p.taxRate) },
  {
    header: 'Low stock threshold',
    width: 10,
    inPdf: false,
    value: (p) =>
      piecesToThreshold(p.lowStockThresholdPieces, p.lowStockThresholdUnit, p.piecesPerBox),
  },
  { header: 'Threshold unit', width: 8, inPdf: false, value: (p) => p.lowStockThresholdUnit },
  { header: 'Stock (pieces)', width: 10, inPdf: true, value: (p) => p.stockPieces },
];

/** The low-stock list (F-13): what to reorder, lowest stock first. */
export const LOW_STOCK_COLUMNS: readonly ExportColumn[] = [
  { header: 'Barcode', width: 16, inPdf: true, value: (p) => safeText(p.barcode) },
  { header: 'Name', width: 40, inPdf: true, value: (p) => safeText(p.name) },
  { header: 'Category', width: 20, inPdf: true, value: (p) => safeText(p.categoryName) },
  { header: 'Stock (pieces)', width: 12, inPdf: true, value: (p) => p.stockPieces },
  { header: 'Threshold (pieces)', width: 12, inPdf: true, value: (p) => p.lowStockThresholdPieces },
];
