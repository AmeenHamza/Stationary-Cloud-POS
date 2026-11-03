import { describe, expect, it } from 'vitest';

import { dataOf, errorCode } from './support/graphql-client';
import { createCustomer } from './support/khata';
import { useRoles } from './support/roles';
import * as sales from './support/sales';
import { asUser } from './support/staff';

const t = useRoles();

const sell = (input: Record<string, unknown>, cookie = t.cashier) =>
  asUser<sales.SaleResult>(t.h.url, cookie, sales.CREATE_SALE, { input });

const counts = async () => ({
  orders: await t.prisma.order.count(),
  movements: await t.prisma.stockMovement.count(),
  outbox: await t.prisma.outboxEvent.count(),
});

describe('createSale (SYSTEM_DESIGN.md §3.3)', () => {
  it('bills the screenshot example: 240.00 + 18 % GST = 283.20 (FIN-01, FIN-12)', async () => {
    const ids = await Promise.all(
      ['120', '70', '50'].map((price) => sales.seedProduct(t.prisma, { price })),
    );
    const input = sales.saleInput(
      ids.map((productId) => ({ productId })),
      { billGst: { applied: true, rate: '18' }, expectedTotal: '283.20' },
    );
    const sale = dataOf(await sell(input)).createSale;
    expect(sale.order).toMatchObject({ total: '283.20', status: 'COMPLETED' });
    expect(sale.order.billNumber).toMatch(/^ORD-\d{8}-001$/);
    expect(sale.receipt).toMatchObject({ billNumber: sale.order.billNumber, customerName: null });
    expect(await sales.stockOf(t.prisma, ids[0] ?? '')).toBe(99);
  });

  it('sells boxes at the box price and takes pieces from stock (FIN-06, D-17)', async () => {
    const id = await sales.seedProduct(t.prisma, {
      price: '90',
      boxPrice: '1000',
      piecesPerBox: 12,
      stock: 30,
    });
    const input = sales.saleInput([{ productId: id, unit: 'BOX', quantity: 2 }], {
      expectedTotal: '2000.00',
    });
    dataOf(await sell(input));
    expect(await sales.stockOf(t.prisma, id)).toBe(6);
    const line = await t.prisma.orderLine.findFirst({
      where: { productId: id },
      select: { piecesPerUnit: true },
    });
    expect(line?.piecesPerUnit).toBe(12);
  });

  it('applies discounts before tax and GST (FIN-03, D-08)', async () => {
    const id = await sales.seedProduct(t.prisma, { price: '1000' });
    const input = sales.saleInput([{ productId: id }], {
      discount: { type: 'PERCENT', percent: '10' },
      billGst: { applied: true, rate: '18' },
      expectedTotal: '1062.00',
    });
    expect(dataOf(await sell(input)).createSale.order).toMatchObject({
      subtotal: '1000.00',
      discountTotal: '100.00',
      billGstAmount: '162.00',
      total: '1062.00',
    });
  });

  it('refuses a changed price and invalid bills without writing anything (FIN-07, FIN-08)', async () => {
    const id = await sales.seedProduct(t.prisma, { price: '50' });
    const before = await counts();
    const stale = await sell(sales.saleInput([{ productId: id }], { expectedTotal: '45.00' }));
    expect(errorCode(stale)).toBe('PRICE_CHANGED');
    expect(stale.body.errors?.[0]?.extensions?.['quote']).toMatchObject({ total: '50.00' });
    const tooMuch = await sell(
      sales.saleInput([{ productId: id }], {
        discount: { type: 'FLAT', amount: '60' },
        expectedTotal: '0.00',
      }),
    );
    expect(errorCode(tooMuch)).toBe('BAD_USER_INPUT');
    const noBox = await sell(
      sales.saleInput([{ productId: id, unit: 'BOX' }], { expectedTotal: '50.00' }),
    );
    expect(errorCode(noBox)).toBe('BAD_USER_INPUT');
    expect(await counts()).toEqual(before);
    expect(await sales.stockOf(t.prisma, id)).toBe(100);
  });

  it('blocks selling products already at 0 or negative stock (FIN-13)', async () => {
    const zero = await sales.seedProduct(t.prisma, { price: '10', stock: 0, name: 'Zero' });
    const negative = await sales.seedProduct(t.prisma, {
      price: '10',
      stock: -2,
      name: 'Negative',
    });
    expect(
      errorCode(await sell(sales.saleInput([{ productId: zero }], { expectedTotal: '10.00' }))),
    ).toBe('BAD_USER_INPUT');
    expect(
      errorCode(await sell(sales.saleInput([{ productId: negative }], { expectedTotal: '10.00' }))),
    ).toBe('BAD_USER_INPUT');
  });

  it('puts an Udhaar bill on the customer khata, and needs a customer (FIN-14, D-15)', async () => {
    const id = await sales.seedProduct(t.prisma, { price: '250' });
    const noCustomer = await sell(
      sales.saleInput([{ productId: id }], { paymentMethod: 'UDHAAR', expectedTotal: '250.00' }),
    );
    expect(errorCode(noCustomer)).toBe('CUSTOMER_REQUIRED');
    const customer = await createCustomer(t.h.url, t.cashier, { name: 'Udhaar Buyer' });
    const sale = dataOf(
      await sell(
        sales.saleInput([{ productId: id }], {
          paymentMethod: 'UDHAAR',
          customerId: customer.id,
          expectedTotal: '250.00',
        }),
      ),
    ).createSale;
    expect(sale.receipt).toMatchObject({ customerName: 'Udhaar Buyer', customerBalance: '250.00' });
    const entries = await t.prisma.customerLedgerEntry.findMany({
      where: { customerId: customer.id },
      select: { type: true, amount: true, balanceAfter: true, orderId: true },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ type: 'CREDIT_SALE', orderId: sale.order.id });
    expect(entries[0]?.balanceAfter.toString()).toBe('250');
  });

  it('emits one stock event for the bill and an order event for admins (RT-01)', async () => {
    const ids = await Promise.all(
      ['5', '6'].map((price) => sales.seedProduct(t.prisma, { price })),
    );
    const sale = dataOf(
      await sell(
        sales.saleInput(
          ids.map((productId) => ({ productId })),
          { expectedTotal: '11.00' },
        ),
      ),
    ).createSale;
    const events = await t.prisma.outboxEvent.findMany({
      where: { type: { in: ['order.created', 'stock.changed'] } },
      orderBy: { seq: 'desc' },
      take: 2,
      select: { type: true, audience: true, payload: true },
    });
    expect(events.map((event) => [event.type, event.audience])).toEqual([
      ['order.created', 'admin'],
      ['stock.changed', 'staff'],
    ]);
    expect(events[0]?.payload).toMatchObject({ orderId: sale.order.id, total: '11.00' });
    expect((events[1]?.payload as { items: unknown[] }).items).toHaveLength(2);
  });
});
