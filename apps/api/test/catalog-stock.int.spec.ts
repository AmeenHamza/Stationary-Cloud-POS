import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import * as catalog from './support/catalog';
import { errorCode } from './support/graphql-client';
import { useRoles } from './support/roles';
import { asUser } from './support/staff';

const t = useRoles();

interface StockResult {
  id: string;
  stockPieces: number;
  isLowStock: boolean;
}

const restock = (input: Record<string, unknown>, cookie = t.admin) =>
  asUser<{ restockProduct: StockResult }>(t.h.url, cookie, catalog.RESTOCK, { input });

const adjust = (input: Record<string, unknown>, cookie = t.admin) =>
  asUser<{ adjustStock: StockResult }>(t.h.url, cookie, catalog.ADJUST, { input });

async function ledgerSum(productId: string): Promise<number> {
  const sum = await t.prisma.stockMovement.aggregate({
    where: { productId },
    _sum: { quantityPieces: true },
  });
  return sum._sum.quantityPieces ?? 0;
}

describe('restockProduct [K] (F-10)', () => {
  it('adds boxes × piecesPerBox + pieces once per idempotency key', async () => {
    const product = await catalog.createProduct(t.h.url, t.admin, {
      piecesPerBox: 12,
      initialStockPieces: 5,
    });
    const input = catalog.restockInput(product.id, { boxes: 2, pieces: 3 });
    const first = catalog.dataOf(await restock(input)).restockProduct;
    expect(first.stockPieces).toBe(5 + 27);
    const replay = catalog.dataOf(await restock(input)).restockProduct;
    expect(replay.stockPieces).toBe(32);
    expect(errorCode(await restock({ ...input, pieces: 4 }))).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(await ledgerSum(product.id)).toBe(32);
  });

  it('keeps every concurrent restock (row lock, single-statement increment)', async () => {
    const product = await catalog.createProduct(t.h.url, t.admin, { initialStockPieces: 0 });
    const results = await Promise.all(
      Array.from({ length: 10 }, () => restock(catalog.restockInput(product.id, { pieces: 2 }))),
    );
    expect(results.every((response) => response.body.errors === undefined)).toBe(true);
    const row = await t.prisma.product.findUnique({
      where: { id: product.id },
      select: { stockPieces: true },
    });
    expect(row?.stockPieces).toBe(20);
    expect(await ledgerSum(product.id)).toBe(20);
  });

  it('refuses archived products, zero quantities and cashiers', async () => {
    const product = await catalog.createProduct(t.h.url, t.admin);
    expect(errorCode(await restock(catalog.restockInput(product.id, { pieces: 0 })))).toBe(
      'BAD_USER_INPUT',
    );
    expect(errorCode(await restock(catalog.restockInput(product.id), t.cashier))).toBe('FORBIDDEN');
    await asUser(t.h.url, t.admin, catalog.ARCHIVE_PRODUCT, { id: product.id });
    expect(errorCode(await restock(catalog.restockInput(product.id)))).toBe('NOT_FOUND');
  });
});

describe('adjustStock [K] (D-18, FIN-23)', () => {
  const adjustInput = (productId: string, overrides: Record<string, unknown> = {}) => ({
    idempotencyKey: randomUUID(),
    productId,
    direction: 'DECREASE',
    quantityPieces: 4,
    reason: 'DAMAGED',
    note: 'Water damage',
    ...overrides,
  });

  it('records signed movements with the reason, and may take stock below zero (D-16)', async () => {
    const product = await catalog.createProduct(t.h.url, t.admin, { initialStockPieces: 3 });
    const down = catalog.dataOf(await adjust(adjustInput(product.id))).adjustStock;
    expect(down.stockPieces).toBe(-1);
    const up = catalog.dataOf(
      await adjust(
        adjustInput(product.id, {
          direction: 'INCREASE',
          quantityPieces: 6,
          reason: 'COUNT_CORRECTION',
        }),
      ),
    ).adjustStock;
    expect(up.stockPieces).toBe(5);
    const movements = await t.prisma.stockMovement.findMany({
      where: {
        productId: product.id,
        type: { in: ['ADJUSTMENT_DECREASE', 'ADJUSTMENT_INCREASE'] },
      },
      orderBy: { id: 'asc' },
      select: { type: true, quantityPieces: true, reason: true, balanceAfter: true },
    });
    expect(movements).toEqual([
      { type: 'ADJUSTMENT_DECREASE', quantityPieces: -4, reason: 'DAMAGED', balanceAfter: -1 },
      {
        type: 'ADJUSTMENT_INCREASE',
        quantityPieces: 6,
        reason: 'COUNT_CORRECTION',
        balanceAfter: 5,
      },
    ]);
  });

  it('needs a reason and the admin role', async () => {
    const product = await catalog.createProduct(t.h.url, t.admin);
    const noReason = await adjust({ ...adjustInput(product.id), reason: null });
    expect(errorCode(noReason)).toBe('BAD_USER_INPUT');
    expect(errorCode(await adjust(adjustInput(product.id), t.cashier))).toBe('FORBIDDEN');
  });

  it('enforces movement signs in the database', async () => {
    const product = await catalog.createProduct(t.h.url, t.admin);
    await expect(
      t.prisma.stockMovement.create({
        data: { productId: product.id, type: 'RESTOCK', quantityPieces: -1, balanceAfter: 0 },
        select: { id: true },
      }),
    ).rejects.toThrow();
  });
});

describe('low stock (F-13, BR-02)', () => {
  const COUNT = '{ lowStockCount }';
  const LIST = '{ lowStockProducts(first: 50) { nodes { id stockPieces isLowStock } } }';
  const count = async () =>
    catalog.dataOf(await asUser<{ lowStockCount: number }>(t.h.url, t.admin, COUNT)).lowStockCount;

  it('counts and lists active products at or below their threshold, emptiest first', async () => {
    const before = await count();
    const low = await catalog.createProduct(t.h.url, t.admin, {
      lowStockThreshold: 5,
      initialStockPieces: 5,
    });
    const lower = await catalog.createProduct(t.h.url, t.admin, {
      lowStockThreshold: 5,
      initialStockPieces: 1,
    });
    await catalog.createProduct(t.h.url, t.admin, { lowStockThreshold: 5, initialStockPieces: 6 });
    expect(low.isLowStock).toBe(true);
    expect(await count()).toBe(before + 2);

    const list = catalog.dataOf(
      await asUser<{ lowStockProducts: { nodes: StockResult[] } }>(t.h.url, t.cashier, LIST),
    ).lowStockProducts.nodes;
    const ids = list.map((node) => node.id);
    expect(ids.indexOf(lower.id)).toBeLessThan(ids.indexOf(low.id));

    await restock(catalog.restockInput(low.id, { pieces: 1 }));
    await asUser(t.h.url, t.admin, catalog.ARCHIVE_PRODUCT, { id: lower.id });
    expect(await count()).toBe(before);
  });
});
