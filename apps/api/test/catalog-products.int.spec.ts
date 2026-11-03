import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import * as catalog from './support/catalog';
import { errorCode } from './support/graphql-client';
import { useRoles } from './support/roles';
import { asUser } from './support/staff';

const t = useRoles();

describe('createProduct [K] (F-08)', () => {
  it('stores the product, its opening movement and the threshold in pieces (BR-01)', async () => {
    const product = await catalog.createProduct(t.h.url, t.admin, {
      barcode: 'BC-1001',
      piecesPerBox: 12,
      boxPrice: '100.00',
      lowStockThreshold: 2,
      lowStockThresholdUnit: 'BOX',
      initialStockPieces: 30,
    });
    expect(product).toMatchObject({
      barcode: 'BC-1001',
      salePrice: '10.00',
      boxPrice: '100.00',
      costPrice: '6.00',
      lowStockThresholdPieces: 24,
      stockPieces: 30,
      isLowStock: false,
      version: 1,
    });
    const movements = await t.prisma.stockMovement.findMany({
      where: { productId: product.id },
      select: { type: true, quantityPieces: true, balanceAfter: true },
    });
    expect(movements).toEqual([{ type: 'OPENING', quantityPieces: 30, balanceAfter: 30 }]);
  });

  it('replays the same key once and refuses the key with another payload (FIN-09/10 style)', async () => {
    const input = catalog.productInput({ name: 'Replay pen' });
    const first = await asUser<{ createProduct: catalog.ProductNode }>(
      t.h.url,
      t.admin,
      catalog.CREATE_PRODUCT,
      {
        input,
      },
    );
    const again = await asUser<{ createProduct: catalog.ProductNode }>(
      t.h.url,
      t.admin,
      catalog.CREATE_PRODUCT,
      {
        input,
      },
    );
    expect(catalog.dataOf(again).createProduct.id).toBe(catalog.dataOf(first).createProduct.id);
    expect(await t.prisma.product.count({ where: { name: 'Replay pen' } })).toBe(1);
    const reused = await asUser(t.h.url, t.admin, catalog.CREATE_PRODUCT, {
      input: { ...input, name: 'Different pen' },
    });
    expect(errorCode(reused)).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('refuses a duplicate active barcode, a box price on single pieces and cashiers', async () => {
    await catalog.createProduct(t.h.url, t.admin, { barcode: 'DUP-1' });
    const duplicate = await asUser(t.h.url, t.admin, catalog.CREATE_PRODUCT, {
      input: catalog.productInput({ barcode: 'DUP-1' }),
    });
    expect(errorCode(duplicate)).toBe('CONFLICT');
    expect(catalog.fieldErrors(duplicate)).toHaveProperty('barcode');

    const boxPrice = await asUser(t.h.url, t.admin, catalog.CREATE_PRODUCT, {
      input: catalog.productInput({ boxPrice: '50.00', piecesPerBox: 1 }),
    });
    expect(errorCode(boxPrice)).toBe('BAD_USER_INPUT');
    expect(catalog.fieldErrors(boxPrice)).toHaveProperty('boxPrice');

    const denied = await asUser(t.h.url, t.cashier, catalog.CREATE_PRODUCT, {
      input: catalog.productInput(),
    });
    expect(errorCode(denied)).toBe('FORBIDDEN');
  });
});

describe('reads and field permissions (SEC-03)', () => {
  it('shows costPrice to admins only; cashiers get the rest of the product', async () => {
    const product = await catalog.createProduct(t.h.url, t.admin);
    const asAdmin = await asUser<{ product: catalog.ProductNode }>(
      t.h.url,
      t.admin,
      catalog.PRODUCT,
      {
        id: product.id,
      },
    );
    expect(catalog.dataOf(asAdmin).product.costPrice).toBe('6.00');

    const asCashier = await asUser<{ product: catalog.ProductNode }>(
      t.h.url,
      t.cashier,
      catalog.PRODUCT,
      {
        id: product.id,
      },
    );
    // The field is null with a FORBIDDEN error on its path; the rest of the product is returned.
    expect(asCashier.body.data?.product).toMatchObject({ id: product.id, costPrice: null });
    expect(errorCode(asCashier)).toBe('FORBIDDEN');
    expect(asCashier.body.errors?.[0]).toMatchObject({ path: ['product', 'costPrice'] });
  });

  it('finds active products by exact barcode and by at most 50 ids', async () => {
    const product = await catalog.createProduct(t.h.url, t.admin, { barcode: 'SCAN-77' });
    const query = 'query B($barcode: String!) { productByBarcode(barcode: $barcode) { id } }';
    const found = await asUser<{ productByBarcode: { id: string } | null }>(
      t.h.url,
      t.cashier,
      query,
      {
        barcode: ' SCAN-77 ',
      },
    );
    expect(catalog.dataOf(found).productByBarcode?.id).toBe(product.id);

    await asUser(t.h.url, t.admin, catalog.ARCHIVE_PRODUCT, { id: product.id });
    const archived = await asUser<{ productByBarcode: null }>(t.h.url, t.cashier, query, {
      barcode: 'SCAN-77',
    });
    expect(catalog.dataOf(archived).productByBarcode).toBeNull();

    const tooMany = await asUser(
      t.h.url,
      t.cashier,
      'query I($ids: [ID!]!) { productsByIds(ids: $ids) { id } }',
      {
        ids: Array.from({ length: 51 }, () => randomUUID()),
      },
    );
    expect(errorCode(tooMany)).toBe('BAD_USER_INPUT');
  });
});
