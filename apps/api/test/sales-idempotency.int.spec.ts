import { describe, expect, it } from 'vitest';

import { dataOf, errorCode } from './support/graphql-client';
import { useRoles } from './support/roles';
import * as sales from './support/sales';
import { asUser } from './support/staff';

const t = useRoles();

const sell = (input: Record<string, unknown>) =>
  asUser<sales.SaleResult>(t.h.url, t.cashier, sales.CREATE_SALE, { input });

describe('retry-safe sales (ADR-015, SYSTEM_DESIGN.md §3.4)', () => {
  it('records one bill for a key sent twice, in sequence and at once (FIN-09)', async () => {
    const id = await sales.seedProduct(t.prisma, { price: '20' });
    const input = sales.saleInput([{ productId: id, quantity: 2 }], { expectedTotal: '40.00' });
    const first = dataOf(await sell(input)).createSale;
    const again = dataOf(await sell(input)).createSale;
    expect(again).toMatchObject({ replayed: true, order: { id: first.order.id } });

    const parallel = sales.saleInput([{ productId: id }], { expectedTotal: '20.00' });
    const results = await Promise.all([sell(parallel), sell(parallel), sell(parallel)]);
    const orderIds = new Set(results.map((result) => dataOf(result).createSale.order.id));
    expect(orderIds.size).toBe(1);
    expect(results.filter((result) => !dataOf(result).createSale.replayed)).toHaveLength(1);
    expect(await sales.stockOf(t.prisma, id)).toBe(97);
  });

  it('refuses a key reused with another cart and confirms lost sales by key (FIN-10)', async () => {
    const id = await sales.seedProduct(t.prisma, { price: '20' });
    const input = sales.saleInput([{ productId: id }], { expectedTotal: '20.00' });
    const sale = dataOf(await sell(input)).createSale;
    const reused = await sell({
      ...input,
      lines: [{ productId: id, unit: 'PIECE', quantity: 2 }],
      expectedTotal: '40.00',
    });
    expect(errorCode(reused)).toBe('IDEMPOTENCY_KEY_REUSED');

    const status = (key: unknown) =>
      asUser<{ saleStatus: { id: string } | null }>(
        t.h.url,
        t.cashier,
        'query S($key: ID!) { saleStatus(idempotencyKey: $key) { id } }',
        { key },
      );
    expect(dataOf(await status(input['idempotencyKey'])).saleStatus?.id).toBe(sale.order.id);
    expect(dataOf(await status(sales.saleInput([])['idempotencyKey'])).saleStatus).toBeNull();
  });

  it('keeps stock and bill numbers exact under parallel counters (FIN-11)', async () => {
    const a = await sales.seedProduct(t.prisma, { price: '10', stock: 500 });
    const b = await sales.seedProduct(t.prisma, { price: '15', stock: 500 });
    const before = await t.prisma.order.count();
    const bills = Array.from({ length: 30 }, (_, index) =>
      sell(
        sales.saleInput(
          index % 2 === 0
            ? [{ productId: a }, { productId: b, quantity: 2 }]
            : [{ productId: b, quantity: 2 }, { productId: a }],
          { expectedTotal: '40.00' },
        ),
      ),
    );
    const results = await Promise.all(bills);
    expect(results.every((result) => result.body.errors === undefined)).toBe(true);
    expect(await sales.stockOf(t.prisma, a)).toBe(470);
    expect(await sales.stockOf(t.prisma, b)).toBe(440);
    const numbers = results
      .map((result) => Number.parseInt(dataOf(result).createSale.order.billNumber.slice(-3), 10))
      .sort((x, y) => x - y);
    expect(numbers).toEqual(Array.from({ length: 30 }, (_, index) => before + index + 1));
    for (const productId of [a, b]) {
      const sum = await t.prisma.stockMovement.aggregate({
        where: { productId },
        _sum: { quantityPieces: true },
      });
      expect(500 + (sum._sum.quantityPieces ?? 0)).toBe(await sales.stockOf(t.prisma, productId));
    }
  });
});
