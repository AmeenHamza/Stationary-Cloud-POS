import { describe, expect, it } from 'vitest';

import { runIntegrityChecks } from '@pos/database';

import * as catalog from './support/catalog';
import { userIdOf } from './support/catalog-io';
import { dataOf, errorCode } from './support/graphql-client';
import { useRoles } from './support/roles';
import * as sales from './support/sales';
import { asUser } from './support/staff';

const t = useRoles();

const DELETE_PRODUCT = 'mutation D($id: ID!) { deleteProduct(id: $id) }';

const remove = (id: string, cookie = t.admin) =>
  asUser<{ deleteProduct: boolean }>(t.h.url, cookie, DELETE_PRODUCT, { id });

const stillThere = async (id: string): Promise<boolean> =>
  (await t.prisma.product.findUnique({ where: { id }, select: { id: true } })) !== null;

const sellOne = (productId: string, expectedTotal: string) =>
  sales.sellAsCashier(t, sales.saleInput([{ productId }], { expectedTotal }));

describe('deleteProduct (D-28)', () => {
  it('removes a never-sold product and its stock history from the database', async () => {
    const product = await catalog.createProduct(t.h.url, t.admin, {
      barcode: 'DEL-1',
      initialStockPieces: 5,
    });
    await asUser(t.h.url, t.admin, catalog.RESTOCK, {
      input: catalog.restockInput(product.id, { pieces: 3 }),
    });
    expect(await t.prisma.stockMovement.count({ where: { productId: product.id } })).toBe(2);

    expect(dataOf(await remove(product.id)).deleteProduct).toBe(true);

    expect(await stillThere(product.id)).toBe(false);
    expect(await t.prisma.stockMovement.count({ where: { productId: product.id } })).toBe(0);
    const event = await t.prisma.outboxEvent.findFirst({
      where: { type: 'product.changed', payload: { path: ['productId'], equals: product.id } },
      orderBy: { seq: 'desc' },
      select: { payload: true },
    });
    expect(event?.payload).toMatchObject({ change: 'DELETED', product: null });
    const audit = await t.prisma.auditLog.findFirst({
      where: { action: 'product.deleted', entityId: product.id },
      select: { id: true },
    });
    expect(audit).not.toBeNull();
    // Its barcode is free again, and a second delete finds nothing.
    await catalog.createProduct(t.h.url, t.admin, { barcode: 'DEL-1' });
    expect(errorCode(await remove(product.id))).toBe('NOT_FOUND');
  });

  it('removes an archived product too, and tells the low-stock list', async () => {
    const low = await catalog.createProduct(t.h.url, t.admin, { initialStockPieces: 1 });
    expect(low.isLowStock).toBe(true);
    dataOf(await remove(low.id));
    const counted = await t.prisma.outboxEvent.findFirst({
      where: { type: 'lowStock.countChanged' },
      orderBy: { seq: 'desc' },
      select: { payload: true },
    });
    expect(counted?.payload).toEqual({ crossedProductIds: [low.id] });

    const archived = await catalog.createProduct(t.h.url, t.admin);
    await asUser(t.h.url, t.admin, catalog.ARCHIVE_PRODUCT, { id: archived.id });
    dataOf(await remove(archived.id));
    expect(await stillThere(archived.id)).toBe(false);
  });

  it('refuses a product on any bill, archived or not, and changes nothing (D-12)', async () => {
    const id = await sales.seedProduct(t.prisma, { price: '10', stock: 5 });
    dataOf(await sellOne(id, '10.00'));
    expect(errorCode(await remove(id))).toBe('HAS_HISTORY');
    await asUser(t.h.url, t.admin, catalog.ARCHIVE_PRODUCT, { id });
    expect(errorCode(await remove(id))).toBe('HAS_HISTORY');
    expect(await stillThere(id)).toBe(true);
    expect(await sales.stockOf(t.prisma, id)).toBe(4);
    expect(await t.prisma.stockMovement.count({ where: { productId: id } })).toBeGreaterThan(0);
  });

  it('deletes an imported product with its import row; clones stay, unlinked', async () => {
    const source = await catalog.createProduct(t.h.url, t.admin);
    const clone = await sales.seedProduct(t.prisma, { price: '10' });
    await t.prisma.product.update({
      where: { id: clone },
      data: { clonedFromId: source.id },
      select: { id: true },
    });
    const job = await t.prisma.importJob.create({
      data: {
        kind: 'PRODUCTS',
        fileName: 'old.csv',
        totalRows: 1,
        processedRows: 1,
        succeededRows: 1,
        createdById: await userIdOf(t.h.url, t.admin),
        rows: {
          create: [{ rowNumber: 2, data: {}, status: 'SUCCEEDED', productId: source.id }],
        },
      },
      select: { id: true },
    });
    dataOf(await remove(source.id));
    const kept = await t.prisma.product.findUnique({
      where: { id: clone },
      select: { clonedFromId: true },
    });
    expect(kept).toEqual({ clonedFromId: null });
    expect(await t.prisma.importJobRow.count({ where: { jobId: job.id } })).toBe(0);
    const stillCounted = await t.prisma.importJob.findUnique({
      where: { id: job.id },
      select: { succeededRows: true },
    });
    expect(stillCounted).toEqual({ succeededRows: 1 });
  });

  it('is for admins only', async () => {
    const product = await catalog.createProduct(t.h.url, t.admin);
    expect(errorCode(await remove(product.id, t.cashier))).toBe('FORBIDDEN');
    expect(await stillThere(product.id)).toBe(true);
  });

  it('a sale of a deleted product is refused and writes nothing', async () => {
    const product = await catalog.createProduct(t.h.url, t.admin, { salePrice: '10.00' });
    dataOf(await remove(product.id));
    const sale = await sellOne(product.id, '10.00');
    expect(errorCode(sale)).toBe('NOT_FOUND');
    expect(sale.body.errors?.[0]?.extensions?.['productIds']).toEqual([product.id]);
  });

  it('racing a sale: either the sale wins and the delete is refused, or the reverse', async () => {
    const raced: string[] = [];
    for (let round = 0; round < 5; round += 1) {
      const product = await catalog.createProduct(t.h.url, t.admin, { salePrice: '10.00' });
      raced.push(product.id);
      const [sale, deletion] = await Promise.all([
        sellOne(product.id, '10.00'),
        remove(product.id),
      ]);
      const saleWon = errorCode(sale) === undefined && errorCode(deletion) === 'HAS_HISTORY';
      const deleteWon = errorCode(sale) === 'NOT_FOUND' && errorCode(deletion) === undefined;
      expect(saleWon || deleteWon).toBe(true);
      expect(await stillThere(product.id)).toBe(saleWon);
    }
    // The fixture products of other tests have no opening movement, so look only at these ones.
    const results = await runIntegrityChecks((sql) => t.prisma.$queryRaw(sql));
    const offenders = results.find((check) => check.name === 'Stock ledger')?.ids ?? [];
    expect(offenders.filter((id) => raced.includes(id))).toEqual([]);
    expect(results.find((check) => check.name === 'Order arithmetic')?.count).toBe(0);
  });
});
