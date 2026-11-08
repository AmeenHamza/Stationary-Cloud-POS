import { describe, expect, it } from 'vitest';

import { runIntegrityChecks } from '@pos/database';

import * as catalog from './support/catalog';
import { completion, csv, download, importEvents, upload, userIdOf } from './support/catalog-io';
import { dataOf } from './support/graphql-client';
import { useRoles } from './support/roles';
import { asUser } from './support/staff';

const t = useRoles();

const HEADER = ['Barcode', 'Name', 'Category', 'Sale price', 'Opening stock'];

describe('product import (F-11, SYSTEM_DESIGN.md §7, Q14, Q37)', () => {
  it('inserts new rows, updates by barcode without touching stock, and reports refused rows', async () => {
    await catalog.createCategory(t.h.url, t.admin, 'Registers');
    const existing = await catalog.createProduct(t.h.url, t.admin, {
      barcode: 'IMP-EXIST-1',
      name: 'Existing item',
      initialStockPieces: 7,
    });
    const events = await importEvents(await userIdOf(t.h.url, t.admin));
    const file = csv([
      HEADER,
      ['IMP-NEW-1', 'Imported register', 'registers', '45.50', 30], // category name ignores case
      ['IMP-EXIST-1', 'Existing renamed', '', '12.00', 99], // stock column ignored (BR-03)
      ['IMP-BAD-1', 'Bad price', '', '12.345', 0],
      ['IMP-NEW-1', 'Repeated barcode', '', '10', 0],
      ['IMP-CAT-1', 'New category item', 'Brand new', '10', 0], // the category is created (D-29)
      ['', 'No barcode item', '', '5', 0],
    ]);
    const response = await upload(t.h.url, t.admin, 'products.csv', file);
    expect(response.status).toBe(202);
    const jobId = String(response.body['importJobId']);
    const done = await completion(events, jobId);
    await events.close();
    expect(done).toMatchObject({ succeededRows: 4, failedRows: 2 });

    const renamed = await t.prisma.product.findUnique({
      where: { id: existing.id },
      select: { name: true, salePrice: true, stockPieces: true },
    });
    expect(renamed).toMatchObject({ name: 'Existing renamed', stockPieces: 7 });
    expect(renamed?.salePrice.toString()).toBe('12');
    const created = await t.prisma.product.findFirst({
      where: { barcode: 'IMP-NEW-1', archivedAt: null },
      select: {
        stockPieces: true,
        category: { select: { name: true } },
        movements: { select: { importJobId: true } },
      },
    });
    expect(created).toEqual({
      stockPieces: 30,
      category: { name: 'Registers' },
      movements: [{ importJobId: jobId }],
    });

    const report = await download(t.h.url, t.admin, `/v1/imports/${jobId}/errors.csv`);
    const lines = report.bytes
      .toString('utf8')
      .replace(/^\uFEFF/, '')
      .trim()
      .split(/\r?\n/);
    expect(lines).toHaveLength(3);
    expect(lines[1]).toMatch(/^4,IMP-BAD-1,Bad price,/);
    expect(lines[2]).toMatch(/^5,IMP-NEW-1,Repeated barcode,Barcode repeats line 2$/);

    const rows = await asUser<{
      importJobRows: { nodes: { rowNumber: number }[]; totalCount: number };
    }>(
      t.h.url,
      t.admin,
      'query R($jobId: ID!) { importJobRows(jobId: $jobId, status: FAILED, first: 2) { nodes { rowNumber } totalCount } }',
      { jobId },
    );
    expect(dataOf(rows).importJobRows).toEqual({
      nodes: [{ rowNumber: 4 }, { rowNumber: 5 }],
      totalCount: 2,
    });
    const bulk = await t.prisma.outboxEvent.findFirst({
      where: { type: 'catalog.bulkChanged' },
      select: { payload: true },
    });
    expect(bulk?.payload).toEqual({ reason: 'IMPORT', importJobId: jobId, changedCount: 4 });
    const integrity = await runIntegrityChecks((sql) => t.prisma.$queryRaw(sql));
    expect(integrity.find((check) => check.name === 'Stock ledger')?.count).toBe(0);
  });

  it('imports legacy column names while preserving stock for existing products', async () => {
    const existing = await catalog.createProduct(t.h.url, t.admin, {
      barcode: 'LEGACY-EXIST',
      name: 'Existing example',
      initialStockPieces: 7,
    });
    const events = await importEvents(await userIdOf(t.h.url, t.admin));
    const headers = [
      'name',
      'barcode',
      'name_urdu',
      'price',
      'cost',
      'stock',
      'base_unit_name',
      'pieces_per_box',
      'box_price',
      'low_stock_threshold',
      'tax_rate',
    ];
    const response = await upload(
      t.h.url,
      t.admin,
      'legacy.csv',
      csv([
        headers,
        ['New example', 'LEGACY-NEW', '', '30', '20', 3, 'Piece', 1, '', 1, 18],
        ['Updated example', 'LEGACY-EXIST', '', '40', '25', 99, 'Piece', 1, '', 2, 18],
      ]),
    );
    expect(response.status).toBe(202);
    const done = await completion(events, String(response.body['importJobId']));
    await events.close();
    expect(done).toMatchObject({ succeededRows: 2, failedRows: 0 });
    const added = await t.prisma.product.findFirstOrThrow({
      where: { barcode: 'LEGACY-NEW', archivedAt: null },
      select: {
        stockPieces: true,
        salePrice: true,
        costPrice: true,
        taxRate: true,
        lowStockThresholdPieces: true,
      },
    });
    expect(added.stockPieces).toBe(3);
    expect(added.salePrice.toString()).toBe('30');
    expect(added.costPrice?.toString()).toBe('20');
    expect(added.taxRate.toString()).toBe('18');
    expect(added.lowStockThresholdPieces).toBe(1);
    const updated = await t.prisma.product.findUniqueOrThrow({
      where: { id: existing.id },
      select: { name: true, stockPieces: true },
    });
    expect(updated).toEqual({ name: 'Updated example', stockPieces: 7 });
  });

  it('serves the template with every header and one example row', async () => {
    const template = await download(t.h.url, t.admin, '/v1/imports/products/template.xlsx');
    expect(template.status).toBe(200);
    expect(template.bytes.subarray(0, 2).toString()).toBe('PK');
  });
});

describe('upload safety (SEC-14)', () => {
  it('refuses oversized, mislabelled and over-long files, a missing CSRF header and cashiers', async () => {
    const tooBig = await upload(
      t.h.url,
      t.admin,
      'big.csv',
      new Uint8Array(5 * 1024 * 1024 + 1).fill(65),
    );
    expect(tooBig.status).toBe(413);
    const mislabelled = await upload(t.h.url, t.admin, 'products.xlsx', csv([HEADER]));
    expect(mislabelled).toMatchObject({ status: 400, body: { code: 'BAD_USER_INPUT' } });
    const rows = Array.from({ length: 5_001 }, (_, index) => [
      `L-${String(index)}`,
      `Item ${String(index)}`,
      '',
      '1',
      0,
    ]);
    const tooLong = await upload(t.h.url, t.admin, 'long.csv', csv([HEADER, ...rows]));
    expect(tooLong).toMatchObject({
      status: 400,
      body: { message: 'At most 5000 rows per file.' },
    });
    const noCsrf = await upload(t.h.url, t.admin, 'p.csv', csv([HEADER, ['', 'X', '', '1', 0]]), {
      csrf: false,
    });
    expect(noCsrf).toMatchObject({ status: 403, body: { code: 'FORBIDDEN' } });
    const cashier = await upload(t.h.url, t.cashier, 'p.csv', csv([HEADER, ['', 'X', '', '1', 0]]));
    expect(cashier).toMatchObject({ status: 403, body: { code: 'FORBIDDEN' } });
    expect(
      await t.prisma.importJob.count({ where: { fileName: { in: ['long.csv', 'p.csv'] } } }),
    ).toBe(0);
  });
});
