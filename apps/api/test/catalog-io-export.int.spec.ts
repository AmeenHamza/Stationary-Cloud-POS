import { randomUUID } from 'node:crypto';

import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import { normalizeNameKey } from '@pos/domain';

import * as catalog from './support/catalog';
import { download } from './support/catalog-io';
import { useRoles } from './support/roles';

const t = useRoles();

const text = (bytes: Buffer): string[] =>
  bytes
    .toString('utf8')
    .replace(/^\uFEFF/, '')
    .trim()
    .split(/\r?\n/);

describe('product and low-stock exports (F-11, F-13, API.md §9)', () => {
  it('streams CSV, XLSX and PDF with the template headers and escapes formula-like text (SEC-14)', async () => {
    await catalog.createProduct(t.h.url, t.admin, {
      name: '=HYPERLINK("http://x")',
      barcode: 'EXP-1',
    });
    await catalog.createProduct(t.h.url, t.admin, {
      name: 'Low gum',
      barcode: 'EXP-2',
      initialStockPieces: 1,
    });

    const file = await download(t.h.url, t.admin, '/v1/exports/products?format=csv');
    expect(file.status).toBe(200);
    expect(file.headers.get('content-disposition')).toMatch(
      /^attachment; filename="products-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
    const lines = text(file.bytes);
    expect(lines[0]).toBe(
      'Barcode,Name,Urdu name,Category,Base unit,Pieces per box,Sale price,Box price,Cost price,Tax rate %,Low stock threshold,Threshold unit,Stock (pieces)',
    );
    expect(lines.find((line) => line.startsWith('EXP-1,'))).toContain(
      `"'=HYPERLINK(""http://x"")"`,
    );

    const xlsx = await download(t.h.url, t.admin, '/v1/exports/products?format=xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(xlsx.bytes).buffer);
    expect(workbook.worksheets[0]?.rowCount).toBe(lines.length);
    const pdf = await download(t.h.url, t.admin, '/v1/exports/products?format=pdf');
    expect(pdf.bytes.subarray(0, 5).toString()).toBe('%PDF-');

    const low = text((await download(t.h.url, t.admin, '/v1/exports/low-stock?format=csv')).bytes);
    expect(low[0]).toBe('Barcode,Name,Category,Stock (pieces),Threshold (pieces)');
    expect(low.some((line) => line.startsWith('EXP-2,Low gum,'))).toBe(true);
    expect((await download(t.h.url, t.cashier, '/v1/exports/products?format=csv')).status).toBe(
      403,
    );
  });

  it('reads 10,000 products in batches of 500 and streams them (bounded memory, ADR-020)', async () => {
    await t.prisma.product.createMany({
      data: Array.from({ length: 10_000 }, (_, index) => {
        const name = `Bulk item ${String(index).padStart(5, '0')}`;
        return {
          id: randomUUID(),
          name,
          nameKey: normalizeNameKey(name),
          salePrice: '10.00',
          stockPieces: 50,
        };
      }),
    });
    await download(t.h.url, t.admin, '/v1/exports/low-stock?format=csv'); // warm-up (session cached)
    t.h.statements.reset();
    const file = await download(t.h.url, t.admin, '/v1/exports/products?format=csv');
    expect(file.headers.get('transfer-encoding')).toBe('chunked'); // streamed, never buffered whole
    expect(text(file.bytes).length).toBeGreaterThan(10_000);
    // Each batch of 500 is two statements (rows, then their category names): 21 batches for
    // 10,000 rows, plus the audit row. Bounded per batch, never one read of the whole table.
    const batches = Math.ceil(10_000 / 500) + 1;
    expect(t.h.statements.count).toBeLessThanOrEqual(batches * 2 + 3);
  });
});
