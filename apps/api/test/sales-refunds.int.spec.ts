import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { dataOf, errorCode } from './support/graphql-client';
import { createCustomer } from './support/khata';
import { useRoles } from './support/roles';
import * as sales from './support/sales';
import { asUser } from './support/staff';

const t = useRoles();

interface OrderDetail {
  order: {
    id: string;
    total: string;
    lines: { id: string; quantity: number }[];
  };
}

async function bill(
  fields: Record<string, unknown>,
  lines: { productId: string; quantity?: number; unit?: 'PIECE' | 'BOX' }[],
) {
  const sale = await asUser<sales.SaleResult>(t.h.url, t.cashier, sales.CREATE_SALE, {
    input: sales.saleInput(lines, fields),
  });
  const id = dataOf(sale).createSale.order.id;
  return dataOf(await asUser<OrderDetail>(t.h.url, t.cashier, sales.ORDER, { id })).order;
}

const refund = (input: Record<string, unknown>) =>
  asUser<sales.RefundResult>(t.h.url, t.cashier, sales.REFUND, {
    input: { idempotencyKey: randomUUID(), ...input },
  });

describe('refunds (SYSTEM_DESIGN.md §3.6, D-11: cashiers refund)', () => {
  it('refunds 1 of 3, then the rest, adding up to the bill exactly (FIN-15, FIN-24)', async () => {
    const id = await sales.seedProduct(t.prisma, { price: '33.33', taxRate: '5' });
    const order = await bill({ billGst: { applied: true, rate: '18' }, expectedTotal: '123.89' }, [
      { productId: id, quantity: 3 },
    ]);
    const lineId = order.lines[0]?.id;
    const mismatch = await refund({
      orderId: order.id,
      lines: [{ orderLineId: lineId, quantity: 1 }],
      expectedAmount: '1.00',
    });
    expect(errorCode(mismatch)).toBe('QUOTE_MISMATCH');
    const amount = mismatch.body.errors?.[0]?.extensions?.['amount'];
    const first = dataOf(
      await refund({
        orderId: order.id,
        lines: [{ orderLineId: lineId, quantity: 1 }],
        expectedAmount: amount,
      }),
    ).refundOrder;
    expect(first.order.status).toBe('PARTIALLY_REFUNDED');
    const rest = await refund({ orderId: order.id, refundAll: true, expectedAmount: '1.00' });
    const restAmount = rest.body.errors?.[0]?.extensions?.['amount'];
    const second = dataOf(
      await refund({ orderId: order.id, refundAll: true, expectedAmount: restAmount }),
    ).refundOrder;
    expect(second.order).toMatchObject({ status: 'REFUNDED', refundedTotal: order.total });
    expect(await sales.stockOf(t.prisma, id)).toBe(100);
  });

  it('returns boxes as pieces and refuses more than remains (FIN-16, FIN-18)', async () => {
    const id = await sales.seedProduct(t.prisma, {
      price: '10',
      boxPrice: '100',
      piecesPerBox: 12,
      stock: 50,
    });
    const order = await bill({ expectedTotal: '200.00' }, [
      { productId: id, unit: 'BOX', quantity: 2 },
    ]);
    const lineId = order.lines[0]?.id;
    const one = {
      orderId: order.id,
      lines: [{ orderLineId: lineId, quantity: 1 }],
      expectedAmount: '100.00',
    };
    dataOf(await refund(one));
    expect(await sales.stockOf(t.prisma, id)).toBe(50 - 24 + 12);
    const [a, b] = await Promise.all([refund(one), refund(one)]);
    const codes = [errorCode(a) ?? 'OK', errorCode(b) ?? 'OK'].sort();
    expect(codes).toEqual(['OK', 'REFUND_EXCEEDS_REMAINING']);
    expect(await sales.stockOf(t.prisma, id)).toBe(50);
  });

  it('credits the khata when refunding an Udhaar bill, which may become an advance (FIN-17, A-03)', async () => {
    const id = await sales.seedProduct(t.prisma, { price: '400' });
    const customer = await createCustomer(t.h.url, t.cashier, { name: 'Refunded Buyer' });
    const order = await bill(
      { paymentMethod: 'UDHAAR', customerId: customer.id, expectedTotal: '400.00' },
      [{ productId: id }],
    );
    await t.prisma.customer.update({
      where: { id: customer.id },
      data: { balance: 0 },
      select: { id: true },
    });
    const result = dataOf(
      await refund({ orderId: order.id, refundAll: true, expectedAmount: '400.00' }),
    ).refundOrder;
    expect(result.refund.settlement).toBe('KHATA_CREDIT');
    const entry = await t.prisma.customerLedgerEntry.findFirst({
      where: { customerId: customer.id, type: 'REFUND_CREDIT' },
      select: { amount: true, balanceAfter: true },
    });
    expect(entry?.amount.toString()).toBe('-400');
    expect(entry?.balanceAfter.toString()).toBe('-400');
  });

  it('lists bills newest first and finds one by its number prefix (F-15)', async () => {
    const id = await sales.seedProduct(t.prisma, { price: '1' });
    const order = await bill({ expectedTotal: '1.00' }, [{ productId: id }]);
    const page = await asUser<{ orders: { nodes: { id: string; billNumber: string }[] } }>(
      t.h.url,
      t.cashier,
      'query O($filter: OrdersFilter) { orders(first: 5, filter: $filter) { nodes { id billNumber } } }',
      {},
    );
    const nodes = dataOf(page).orders.nodes;
    expect(nodes[0]?.id).toBe(order.id);
    const prefix = nodes[0]?.billNumber.slice(0, 12).toLowerCase();
    const found = await asUser<{ orders: { nodes: { id: string }[] } }>(
      t.h.url,
      t.cashier,
      'query O($filter: OrdersFilter) { orders(filter: $filter) { nodes { id } } }',
      { filter: { billNumberPrefix: prefix } },
    );
    expect(dataOf(found).orders.nodes.length).toBeGreaterThan(0);
  });

  it('hides bills older than 90 days unless the archive is asked for (F-35, PAG-08)', async () => {
    const id = await sales.seedProduct(t.prisma, { price: '2' });
    const order = await bill({ expectedTotal: '2.00' }, [{ productId: id }]);
    await t.prisma.order.update({
      where: { id: order.id },
      data: { createdAt: new Date(Date.UTC(2026, 5, 1)) },
      select: { id: true },
    });
    const ids = async (filter: Record<string, unknown>) => {
      const page = await asUser<{ orders: { nodes: { id: string }[] } }>(
        t.h.url,
        t.cashier,
        'query O($filter: OrdersFilter) { orders(filter: $filter) { nodes { id } } }',
        { filter },
      );
      return dataOf(page).orders.nodes.map((node) => node.id);
    };
    expect(await ids({})).not.toContain(order.id);
    expect(await ids({ includeArchived: true })).toContain(order.id);
  });
});
