import { writeCsv, writePdf, writeXlsx, type ExportSheet } from '../application/export-writers';

import type { ExportFormat } from '@pos/contracts';
import type { Response } from 'express';

const CONTENT_TYPE: Readonly<Record<ExportFormat, string>> = {
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

const WRITER = { csv: writeCsv, xlsx: writeXlsx, pdf: writePdf } as const;

/** Streams a sheet as an attachment named `<name>.<format>` (never buffered whole, ADR-020). */
export async function sendSheet(
  res: Response,
  format: ExportFormat,
  name: string,
  sheet: ExportSheet,
): Promise<void> {
  res.setHeader('Content-Type', CONTENT_TYPE[format]);
  res.setHeader('Content-Disposition', `attachment; filename="${name}.${format}"`);
  res.setHeader('Cache-Control', 'no-store');
  await WRITER[format](sheet, res);
}
