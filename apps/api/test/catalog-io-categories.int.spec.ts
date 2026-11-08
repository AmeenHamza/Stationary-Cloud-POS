import { describe, expect, it } from 'vitest';

import * as catalog from './support/catalog';
import { completion, csv, download, importEvents, upload, userIdOf } from './support/catalog-io';
import { dataOf } from './support/graphql-client';
import { useRoles } from './support/roles';
import { asUser } from './support/staff';

const t = useRoles();

const HEADER = ['Barcode', 'Name', 'Category', 'Sale price', 'Opening stock'];

/** Uploads a file and waits for its job to finish. */
async function importFile(content: string | Uint8Array, fileName = 'products.csv') {
  const events = await importEvents(await userIdOf(t.h.url, t.admin));
  const response = await upload(t.h.url, t.admin, fileName, content);
  expect(response.status).toBe(202);
  const jobId = String(response.body['importJobId']);
  const done = await completion(events, jobId);
  await events.close();
  return { jobId, done };
}

const categoryOf = async (barcode: string): Promise<string | null | undefined> => {
  const product = await t.prisma.product.findFirst({
    where: { barcode, archivedAt: null },
    select: { category: { select: { name: true } } },
  });
  return product?.category?.name ?? null;
};

const categoryNames = async (): Promise<string[]> => {
  const rows = await t.prisma.category.findMany({
    select: { name: true },
    orderBy: { name: 'asc' },
    take: 50,
  });
  return rows.map((row) => row.name);
};

describe('imports create the categories in the file (D-29)', () => {
  it('creates missing categories first and files each product under its category', async () => {
    await catalog.createCategory(t.h.url, t.admin, 'Existing');
    const { jobId, done } = await importFile(
      csv([
        HEADER,
        ['CAT-1', 'Blue pen', 'Pens', '10', 5],
        ['CAT-2', 'Red pen', 'pens', '10', 5], // the same category, ignoring case
        ['CAT-3', 'Ruler', 'Geometry', '20', 5],
        ['CAT-4', 'Old thing', 'existing', '30', 5], // an existing category is reused
        ['CAT-5', 'Loose item', '', '40', 5], // blank stays Uncategorised
        ['CAT-6', 'Bad price', 'Only on a refused row', 'not a price', 0],
        ['CAT-1', 'Repeated barcode', 'Only on a repeated row', '10', 0],
      ]),
    );
    expect(done).toMatchObject({ succeededRows: 5, failedRows: 2 });
    expect(await categoryNames()).toEqual(['Existing', 'Geometry', 'Pens']); // no refused-row names
    expect(await categoryOf('CAT-1')).toBe('Pens');
    expect(await categoryOf('CAT-2')).toBe('Pens');
    expect(await categoryOf('CAT-3')).toBe('Geometry');
    expect(await categoryOf('CAT-4')).toBe('Existing');
    expect(await categoryOf('CAT-5')).toBeNull();
    const audit = await t.prisma.auditLog.findFirst({
      where: { action: 'catalog.importStarted', entityId: jobId },
      select: { metadata: true },
    });
    expect(audit?.metadata).toMatchObject({ rows: 7, refused: 2, categoriesCreated: 2 });
  });

  it('shows the new categories with their counts on the next read (cache invalidated)', async () => {
    await asUser(t.h.url, t.admin, catalog.CATEGORIES); // fills the cached first page
    await importFile(csv([HEADER, ['CAT-CACHE', 'Glue', 'Adhesives', '10', 1]]));
    const list = dataOf(
      await asUser<{ categories: { nodes: { name: string; productCount: number }[] } }>(
        t.h.url,
        t.admin,
        catalog.CATEGORIES,
      ),
    );
    expect(list.categories.nodes).toContainEqual(
      expect.objectContaining({ name: 'Adhesives', productCount: 1 }),
    );
  });

  it('reads the legacy category_name column', async () => {
    const { done } = await importFile(
      csv([
        ['barcode', 'name', 'category_name', 'price', 'stock'],
        ['CAT-LEGACY', 'Legacy item', 'Legacy shelf', '12', 2],
      ]),
      'legacy.csv',
    );
    expect(done).toMatchObject({ succeededRows: 1, failedRows: 0 });
    expect(await categoryOf('CAT-LEGACY')).toBe('Legacy shelf');
  });
});

describe('export then import keeps categories (F-11, D-29)', () => {
  it('exports the Category column, and importing that file brings a deleted category back', async () => {
    const shelf = await catalog.createCategory(t.h.url, t.admin, 'Round trip');
    await catalog.createProduct(t.h.url, t.admin, {
      barcode: 'TRIP-1',
      name: 'Trip item',
      categoryId: shelf.id,
    });
    const exported = await download(t.h.url, t.admin, '/v1/exports/products?format=csv');
    const row = exported.bytes
      .toString('utf8')
      .split(/\r?\n/)
      .find((line) => line.startsWith('TRIP-1,'));
    expect(row).toContain(',Round trip,');

    await asUser(t.h.url, t.admin, catalog.DELETE_CATEGORY, { id: shelf.id });
    expect(await categoryOf('TRIP-1')).toBeNull();

    await importFile(new Uint8Array(exported.bytes));
    expect(await categoryOf('TRIP-1')).toBe('Round trip');
  });
});
