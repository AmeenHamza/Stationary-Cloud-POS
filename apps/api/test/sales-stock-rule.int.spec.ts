import { describe, expect, it } from 'vitest';

import { MAX_EVENT_BYTES } from '@pos/contracts';

import { dataOf, errorCode } from './support/graphql-client';
import { useRoles } from './support/roles';
import * as sales from './support/sales';
import { asUser } from './support/staff';

const t = useRoles();

const LOW_STOCK = '{ lowStockProducts(first: 50) { nodes { id } } }';

describe('selling and stock (D-16, FIN-13)', () => {
  it('warns and still sells more than the stock left, and the product shows as low', async () => {
    const id = await sales.seedProduct(t.prisma, { price: '10', stock: 2, name: 'Two left' });
    const input = sales.saleInput([{ productId: id, quantity: 3 }], { expectedTotal: '30.00' });
    const sale = dataOf(await sales.sellAsCashier(t, input)).createSale;
    expect(sale.stockWarnings).toEqual([
      { productId: id, productName: 'Two left', stockAfter: -1 },
    ]);
    expect(await sales.stockOf(t.prisma, id)).toBe(-1);
    const low = dataOf(
      await asUser<{ lowStockProducts: { nodes: { id: string }[] } }>(t.h.url, t.admin, LOW_STOCK),
    );
    expect(low.lowStockProducts.nodes.map((node) => node.id)).toContain(id);
  });

  it('refuses a product at 0 or below and writes nothing', async () => {
    const id = await sales.seedProduct(t.prisma, { price: '10', stock: 0, name: 'None left' });
    const orders = await t.prisma.order.count();
    const movements = await t.prisma.stockMovement.count();
    const refused = await sales.sellAsCashier(
      t,
      sales.saleInput([{ productId: id }], { expectedTotal: '10.00' }),
    );
    expect(errorCode(refused)).toBe('BAD_USER_INPUT');
    expect(await t.prisma.order.count()).toBe(orders);
    expect(await t.prisma.stockMovement.count()).toBe(movements);
    expect(await sales.stockOf(t.prisma, id)).toBe(0);
  });

  it('sells 11 and 100 lines: stock and low-stock events split, each within 1 KB', async () => {
    for (const lines of [11, 100]) {
      // Stock 6, threshold 5: selling 2 of each puts every product below its threshold.
      const ids = await Promise.all(
        Array.from({ length: lines }, () => sales.seedProduct(t.prisma, { price: '1', stock: 6 })),
      );
      const before = await t.prisma.outboxEvent.aggregate({ _max: { seq: true } });
      const input = sales.saleInput(
        ids.map((productId) => ({ productId, quantity: 2 })),
        { expectedTotal: `${String(lines * 2)}.00` },
      );
      dataOf(await sales.sellAsCashier(t, input));
      const events = await t.prisma.outboxEvent.findMany({
        where: {
          seq: { gt: before._max.seq ?? 0n },
          type: { in: ['stock.changed', 'lowStock.countChanged'] },
        },
        select: { type: true, payload: true },
      });
      for (const event of events) {
        expect(Buffer.byteLength(JSON.stringify(event.payload))).toBeLessThanOrEqual(
          MAX_EVENT_BYTES,
        );
      }
      const of = (type: string, field: string) =>
        events
          .filter((event) => event.type === type)
          .flatMap((event) => (event.payload as Record<string, unknown[]>)[field] ?? []);
      const stocked = of('stock.changed', 'items') as { productId: string; stockPieces: number }[];
      expect(stocked.map((item) => item.productId).sort()).toEqual([...ids].sort());
      expect(stocked.every((item) => item.stockPieces === 4)).toBe(true);
      expect((of('lowStock.countChanged', 'crossedProductIds') as string[]).sort()).toEqual(
        [...ids].sort(),
      );
    }
  });

  it('lets one of two counters sell the last unit and refuses the other', async () => {
    const id = await sales.seedProduct(t.prisma, { price: '10', stock: 1, name: 'Last one' });
    const attempt = () =>
      sales.sellAsCashier(t, sales.saleInput([{ productId: id }], { expectedTotal: '10.00' }));
    const results = await Promise.all([attempt(), attempt()]);
    const codes = results.map((result) => errorCode(result));
    expect(codes.filter((code) => code === undefined)).toHaveLength(1);
    expect(codes.filter((code) => code === 'BAD_USER_INPUT')).toHaveLength(1);
    expect(await sales.stockOf(t.prisma, id)).toBe(0);
  });
});
