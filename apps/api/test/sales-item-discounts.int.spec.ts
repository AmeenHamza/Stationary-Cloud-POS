import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { runIntegrityChecks } from '@pos/database';

import { dataOf, errorCode } from './support/graphql-client';
import { useRoles } from './support/roles';
import * as sales from './support/sales';
import { asUser } from './support/staff';

const t = useRoles();

const SALE = `mutation Sale($input: CreateSaleInput!) {
  createSale(input: $input) {
    replayed
    order { id total subtotal discountType discountTotal itemDiscountTotal productTaxTotal billGstAmount }
    receipt { lines { name lineTotal itemDiscount } }
  }
}`;

interface ItemSale {
  createSale: {
    replayed: boolean;
    order: Record<string, string> & { id: string };
    receipt: { lines: { name: string; lineTotal: string; itemDiscount: string }[] };
  };
}

const sell = (input: Record<string, unknown>) =>
  asUser<ItemSale>(t.h.url, t.cashier, SALE, { input });

const tenPercent = { type: 'PERCENT', percent: '10' };

const storedLines = (orderId: string) =>
  t.prisma.orderLine.findMany({
    where: { orderId },
    orderBy: { lineNo: 'asc' },
    take: 10,
    select: { itemDiscount: true, lineDiscount: true, lineNet: true },
  });

const asText = (rows: Awaited<ReturnType<typeof storedLines>>) =>
  rows.map((r) => [r.itemDiscount.toFixed(2), r.lineDiscount.toFixed(2), r.lineNet.toFixed(2)]);

describe('a discount on one item of a bill (D-27, F-39)', () => {
  it('FIN-25: discounts that item alone and records it on the bill and the receipt', async () => {
    const pen = await sales.seedProduct(t.prisma, { name: 'Pen', price: '1000' });
    const ruler = await sales.seedProduct(t.prisma, { name: 'Ruler', price: '500' });
    const sale = dataOf(
      await sell(
        sales.saleInput([{ productId: pen, discount: tenPercent }, { productId: ruler }], {
          expectedTotal: '1400.00',
        }),
      ),
    ).createSale;
    expect(sale.order).toMatchObject({
      subtotal: '1500.00',
      discountType: 'NONE',
      discountTotal: '100.00',
      itemDiscountTotal: '100.00',
      total: '1400.00',
    });
    expect(sale.receipt.lines).toEqual([
      { name: 'Pen', lineTotal: '1000.00', itemDiscount: '100.00' },
      { name: 'Ruler', lineTotal: '500.00', itemDiscount: '0.00' },
    ]);
    expect(asText(await storedLines(sale.order.id))).toEqual([
      ['100.00', '100.00', '900.00'],
      ['0.00', '0.00', '500.00'],
    ]);
  });

  it('FIN-26: the overall discount comes off what item discounts left', async () => {
    const pen = await sales.seedProduct(t.prisma, { price: '1000' });
    const ruler = await sales.seedProduct(t.prisma, { price: '500' });
    const sale = dataOf(
      await sell(
        sales.saleInput([{ productId: pen, discount: tenPercent }, { productId: ruler }], {
          discount: tenPercent,
          expectedTotal: '1260.00',
        }),
      ),
    ).createSale;
    expect(sale.order).toMatchObject({
      discountType: 'PERCENT',
      discountTotal: '240.00',
      itemDiscountTotal: '100.00',
      total: '1260.00',
    });
    expect(asText(await storedLines(sale.order.id))).toEqual([
      ['100.00', '190.00', '810.00'],
      ['0.00', '50.00', '450.00'],
    ]);
  });

  it('FIN-27: is taken before product tax and Bill GST, on custom lines too', async () => {
    const pen = await sales.seedProduct(t.prisma, { price: '100', taxRate: '10' });
    const custom = {
      name: 'Binding',
      unit: 'PIECE',
      quantity: 1,
      unitPrice: '100',
      taxRate: '0',
      discount: { type: 'FLAT', amount: '20' },
    };
    const sale = dataOf(
      await sell(
        sales.saleInput(
          [{ productId: pen, quantity: 3, discount: { type: 'FLAT', amount: '50' } }],
          {
            customLines: [custom],
            billGst: { applied: true, rate: '18' },
            expectedTotal: '418.90',
          },
        ),
      ),
    ).createSale;
    // 300 - 50 = 250, tax 25; 100 - 20 = 80; GST 18 % of 355 = 63.90.
    expect(sale.order).toMatchObject({
      itemDiscountTotal: '70.00',
      productTaxTotal: '25.00',
      billGstAmount: '63.90',
      total: '418.90',
    });
  });

  it('FIN-28: refuses a discount above the item and a changed total, writing nothing', async () => {
    const pen = await sales.seedProduct(t.prisma, { price: '50' });
    const before = await t.prisma.order.count();
    const tooMuch = await sell(
      sales.saleInput([{ productId: pen, discount: { type: 'FLAT', amount: '50.01' } }], {
        expectedTotal: '0.00',
      }),
    );
    expect(errorCode(tooMuch)).toBe('BAD_USER_INPUT');
    const stale = await sell(
      sales.saleInput([{ productId: pen, discount: tenPercent }], {
        expectedTotal: '50.00',
      }),
    );
    expect(errorCode(stale)).toBe('PRICE_CHANGED');
    expect(await t.prisma.order.count()).toBe(before);
    expect(await sales.stockOf(t.prisma, pen)).toBe(100);
  });

  it('replays the same key without a second bill', async () => {
    const pen = await sales.seedProduct(t.prisma, { price: '100' });
    const input = sales.saleInput([{ productId: pen, discount: tenPercent }], {
      expectedTotal: '90.00',
    });
    dataOf(await sell(input));
    const again = dataOf(await sell(input)).createSale;
    expect(again.replayed).toBe(true);
    expect(again.order).toMatchObject({ itemDiscountTotal: '10.00', total: '90.00' });
    expect(await sales.stockOf(t.prisma, pen)).toBe(99);
  });

  it('refunds the discounted price, part by part, down to the exact total (A-06)', async () => {
    const pen = await sales.seedProduct(t.prisma, { price: '100', stock: 10 });
    const sale = dataOf(
      await sell(
        sales.saleInput([{ productId: pen, quantity: 2, discount: tenPercent }], {
          expectedTotal: '180.00',
        }),
      ),
    ).createSale;
    const [line] = await t.prisma.orderLine.findMany({
      where: { orderId: sale.order.id },
      take: 1,
      select: { id: true },
    });
    const refund = (fields: Record<string, unknown>) =>
      asUser<sales.RefundResult>(t.h.url, t.cashier, sales.REFUND, {
        input: { idempotencyKey: randomUUID(), orderId: sale.order.id, ...fields },
      });
    const part = dataOf(
      await refund({
        lines: [{ orderLineId: line?.id.toString(), quantity: 1 }],
        expectedAmount: '90.00',
      }),
    ).refundOrder;
    expect(part.refund.amount).toBe('90.00');
    expect(await sales.stockOf(t.prisma, pen)).toBe(9);
    const rest = dataOf(await refund({ refundAll: true, expectedAmount: '90.00' })).refundOrder;
    expect(rest.order).toMatchObject({ status: 'REFUNDED', refundedTotal: '180.00' });
    expect(await sales.stockOf(t.prisma, pen)).toBe(10);
  });

  it('keeps every stored bill consistent (DATABASE.md §12)', async () => {
    const results = await runIntegrityChecks((sql) => t.prisma.$queryRaw(sql));
    // `seedProduct` sets stock with no opening movement, so the stock ledger check does not apply.
    const bills = results.filter((check) => check.name !== 'Stock ledger');
    expect(bills.map((check) => check.name)).toContain('Order arithmetic');
    expect(bills.filter((check) => check.count > 0)).toEqual([]);
  });
});
