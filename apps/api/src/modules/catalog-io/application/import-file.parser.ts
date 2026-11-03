import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';

import { IMPORT_MAX_ROWS } from '@pos/contracts';
import { IMPORT_COLUMNS } from '@pos/validation';

import { AppError } from '../../../common/errors/app-error';

/** One data line: spreadsheet line number (2 = first data row) and its cells by field. */
export interface ParsedRow {
  rowNumber: number;
  cells: Record<string, string>;
}

const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const REQUIRED = ['name', 'salePrice'] as const;
type ImportField = (typeof IMPORT_COLUMNS)[number]['field'];
const LEGACY_HEADERS: Partial<Record<ImportField, readonly string[]>> = {
  nameUrdu: ['name_urdu'],
  salePrice: ['price'],
  costPrice: ['cost'],
  openingStock: ['stock'],
  baseUnitLabel: ['base_unit_name'],
  piecesPerBox: ['pieces_per_box'],
  boxPrice: ['box_price'],
  lowStockThreshold: ['low_stock_threshold'],
  taxRate: ['tax_rate'],
};

const refuse = (message: string): AppError =>
  new AppError('BAD_USER_INPUT', message, { fieldErrors: { file: message } });

/** The type the bytes say, not the name: an .xlsx is a ZIP, a .csv is text without NUL bytes. */
function kindOf(fileName: string, bytes: Buffer): 'xlsx' | 'csv' {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.xlsx') && bytes.subarray(0, 4).equals(ZIP_MAGIC)) return 'xlsx';
  if (lower.endsWith('.csv') && !bytes.includes(0) && !bytes.subarray(0, 4).equals(ZIP_MAGIC)) {
    return 'csv';
  }
  throw refuse('Upload the template as .xlsx or .csv.');
}

/** A cell as text: numbers and booleans as written, formulas by their result, errors blank. */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if ('richText' in value)
    return value.richText
      .map((part) => part.text)
      .join('')
      .trim();
  if ('formula' in value || 'sharedFormula' in value) return cellText(value.result ?? null);
  if ('hyperlink' in value) return value.text.trim();
  return ''; // an error value such as #N/A
}

async function xlsxRows(bytes: Buffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(new Uint8Array(bytes).buffer); // an ArrayBuffer copy (≤ 5 MB)
  const sheet = workbook.worksheets[0];
  if (sheet === undefined) throw refuse('The workbook has no sheet.');
  if (sheet.rowCount > IMPORT_MAX_ROWS + 1)
    throw refuse(`At most ${String(IMPORT_MAX_ROWS)} rows per file.`);
  const rows: (string[] | undefined)[] = [];
  sheet.eachRow({ includeEmpty: true }, (row, number) => {
    const values = row.values as ExcelJS.CellValue[]; // index 0 is unused by ExcelJS
    rows[number - 1] = values.slice(1).map(cellText);
  });
  return Array.from(rows, (row) => row ?? []);
}

function csvRows(bytes: Buffer): string[][] {
  return parse(bytes, { bom: true, relax_column_count: true, trim: true, to: IMPORT_MAX_ROWS + 2 });
}

/**
 * Reads an upload (SYSTEM_DESIGN.md §7, SEC-14): checks the real file type, maps the header row to
 * template fields (any order, any case), drops blank lines and refuses more than 5,000 data rows.
 */
export async function parseImportFile(fileName: string, bytes: Buffer): Promise<ParsedRow[]> {
  const table = kindOf(fileName, bytes) === 'xlsx' ? await xlsxRows(bytes) : csvRows(bytes);
  const header = (table[0] ?? []).map((cell) => cell.trim().toLowerCase());
  const columns = IMPORT_COLUMNS.map((column) => {
    const names = [column.header.toLowerCase(), ...(LEGACY_HEADERS[column.field] ?? [])];
    const indices = header.flatMap((name, index) => (names.includes(name) ? [index] : []));
    if (indices.length > 1) throw refuse(`More than one column maps to ${column.header}.`);
    return { field: column.field, index: indices[0] ?? -1 };
  }).filter((column) => column.index >= 0);
  const missing = REQUIRED.filter((field) => !columns.some((column) => column.field === field));
  if (missing.length > 0) {
    throw refuse('The first row needs Name and Sale price (or legacy price).');
  }
  const rows = table
    .slice(1)
    .map((cells, index) => ({
      rowNumber: index + 2,
      cells: Object.fromEntries(columns.map((c) => [c.field, (cells[c.index] ?? '').trim()])),
    }))
    .filter((row) => Object.values(row.cells).some((value) => value !== ''));
  if (rows.length === 0) throw refuse('The file has no product rows.');
  if (rows.length > IMPORT_MAX_ROWS)
    throw refuse(`At most ${String(IMPORT_MAX_ROWS)} rows per file.`);
  return rows;
}
