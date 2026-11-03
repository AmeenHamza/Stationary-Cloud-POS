import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import * as catalog from './support/catalog';
import { errorCode } from './support/graphql-client';
import { useRoles } from './support/roles';
import { asUser } from './support/staff';

const t = useRoles();

describe('updateProduct [V], archive and restore (Q16b)', () => {
  it('updates with the current version and refuses a stale one', async () => {
    const product = await catalog.createProduct(t.h.url, t.admin);
    const input = catalog.updateInput(product, { name: 'Renamed', salePrice: '12.50' });
    const updated = await asUser<{ updateProduct: catalog.ProductNode }>(
      t.h.url,
      t.admin,
      catalog.UPDATE_PRODUCT,
      {
        input,
      },
    );
    expect(catalog.dataOf(updated).updateProduct).toMatchObject({
      name: 'Renamed',
      salePrice: '12.50',
      stockPieces: 20,
      version: 2,
    });
    const stale = await asUser(t.h.url, t.admin, catalog.UPDATE_PRODUCT, { input });
    expect(errorCode(stale)).toBe('CONFLICT');
  });

  it('archives (freeing the barcode) and refuses a restore that would duplicate it', async () => {
    const original = await catalog.createProduct(t.h.url, t.admin, { barcode: 'ARC-1' });
    const archived = await asUser<{ archiveProduct: catalog.ProductNode }>(
      t.h.url,
      t.admin,
      catalog.ARCHIVE_PRODUCT,
      {
        id: original.id,
      },
    );
    expect(catalog.dataOf(archived).archiveProduct.archivedAt).not.toBeNull();
    await catalog.createProduct(t.h.url, t.admin, { barcode: 'ARC-1' });

    const restore = await asUser(t.h.url, t.admin, catalog.RESTORE_PRODUCT, { id: original.id });
    expect(errorCode(restore)).toBe('CONFLICT');
    expect(catalog.fieldErrors(restore)).toHaveProperty('barcode');
  });
});

describe('cloneProduct [K] (F-09, D-19, BR-04)', () => {
  it('copies every attribute except barcode and stock', async () => {
    const source = await catalog.createProduct(t.h.url, t.admin, {
      barcode: 'SRC-1',
      nameUrdu: 'قلم',
      piecesPerBox: 10,
      boxPrice: '90.00',
      taxRate: '5',
    });
    const response = await asUser<{ cloneProduct: catalog.ProductNode }>(
      t.h.url,
      t.admin,
      catalog.CLONE_PRODUCT,
      {
        input: {
          idempotencyKey: randomUUID(),
          sourceProductId: source.id,
          barcode: 'SRC-2',
          initialStockPieces: 3,
        },
      },
    );
    const clone = catalog.dataOf(response).cloneProduct;
    expect(clone.id).not.toBe(source.id);
    expect(clone).toMatchObject({
      barcode: 'SRC-2',
      name: source.name,
      nameUrdu: 'قلم',
      piecesPerBox: 10,
      boxPrice: '90.00',
      costPrice: '6.00',
      taxRate: '5.00',
      stockPieces: 3,
    });
    const row = await t.prisma.product.findUnique({
      where: { id: clone.id },
      select: { clonedFromId: true },
    });
    expect(row?.clonedFromId).toBe(source.id);
  });
});
