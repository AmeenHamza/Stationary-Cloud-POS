import { once } from 'node:events';

import { stringify } from 'csv-stringify';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

import { formatRs } from '@pos/domain';

import type { Cell, ExportColumn } from './export-columns';
import type { ProductView } from '../../catalog';
import type { Writable } from 'node:stream';

export interface ExportSheet {
  title: string;
  columns: readonly ExportColumn[];
  batches: AsyncIterable<ProductView[]>;
}

const cells = (columns: readonly ExportColumn[], product: ProductView): Cell[] =>
  columns.map((column) => column.value(product));

/** CSV through `csv-stringify`, written batch by batch with back-pressure. */
export async function writeCsv(sheet: ExportSheet, out: Writable): Promise<void> {
  const csv = stringify({ bom: true });
  csv.pipe(out);
  csv.write(sheet.columns.map((column) => column.header));
  for await (const batch of sheet.batches) {
    for (const product of batch) {
      if (!csv.write(cells(sheet.columns, product))) await once(csv, 'drain');
    }
  }
  csv.end();
  await once(out, 'finish');
}

/** XLSX with ExcelJS's streaming writer: each row is committed and released as it is written. */
export async function writeXlsx(sheet: ExportSheet, out: Writable): Promise<void> {
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: out, useStyles: false });
  const worksheet = workbook.addWorksheet(sheet.title);
  worksheet.columns = sheet.columns.map((column) => ({
    header: column.header,
    width: column.width,
  }));
  for await (const batch of sheet.batches) {
    for (const product of batch) {
      worksheet.addRow(cells(sheet.columns, product)).commit();
    }
  }
  worksheet.commit();
  await workbook.commit();
}

const PAGE = { margin: 28, rowHeight: 16, fontSize: 8 };

/** A4 landscape table of the columns marked for PDF; money as "Rs 1,234.50" (Q24). */
export async function writePdf(sheet: ExportSheet, out: Writable): Promise<void> {
  const columns = sheet.columns.filter((column) => column.inPdf);
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: PAGE.margin });
  doc.pipe(out);
  const usable = doc.page.width - PAGE.margin * 2;
  const total = columns.reduce((sumOf, column) => sumOf + column.width, 0);
  const widths = columns.map((column) => (column.width / total) * usable);
  const row = (values: string[], bold: boolean) => {
    if (doc.y + PAGE.rowHeight > doc.page.height - PAGE.margin) doc.addPage();
    const y = doc.y;
    let x = PAGE.margin;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(PAGE.fontSize);
    values.forEach((value, index) => {
      const width = widths[index] ?? 0;
      doc.text(value, x, y, {
        width: width - 4,
        height: PAGE.rowHeight,
        ellipsis: true,
        lineBreak: false,
      });
      x += width;
    });
    doc.x = PAGE.margin;
    doc.y = y + PAGE.rowHeight;
  };
  doc.font('Helvetica-Bold').fontSize(12).text(sheet.title);
  doc.moveDown(0.5);
  row(
    columns.map((column) => column.header),
    true,
  );
  for await (const batch of sheet.batches) {
    for (const product of batch) {
      row(
        columns.map((column) => text(column, column.value(product))),
        false,
      );
    }
  }
  doc.end();
  await once(out, 'finish');
}

function text(column: ExportColumn, value: Cell): string {
  if (value === null) return '';
  return column.isMoney === true ? formatRs(String(value)) : String(value);
}
