import { randomUUID } from 'node:crypto';

import { expect } from 'vitest';

import { ClockService } from '../../src/common/time/clock.service';

import { dataOf } from './graphql-client';
import * as khata from './khata';
import * as sales from './sales';
import { asUser } from './staff';

import type { RoleHarness } from './roles';

/** Dashboard queries as the admin screen sends them (live tiles and history, API.md §6.3). */
export const LIVE = `query DashboardLive($date: BusinessDate) { dashboard(date: $date) {
  date today { netSales billCount discountTotal taxTotal refundTotal }
  inventory { sellingValue costValue productCount }
  customerDues customerCount vendorOwes vendorCount
  paymentMethodsToday: paymentMethods(period: TODAY) { method total billCount }
  paymentMethodsThisWeek: paymentMethods(period: THIS_WEEK) { method total billCount }
  paymentMethodsThisMonth: paymentMethods(period: THIS_MONTH) { method total billCount } } }`;

export const HISTORY = `query DashboardHistory($year: Int!, $productId: ID) { dashboard {
  monthlySales(year: $year) { month total sameMonthLastYear }
  dailySales(days: 31) { date total }
  productDays: dailySales(days: 31, productId: $productId) { date total }
  top: productRanking(direction: HIGHEST) { name units total }
  bottom: productRanking(direction: LOWEST) { name units } } }`;

interface Bill {
  id: string;
}
const sell = async (t: RoleHarness, input: Record<string, unknown>): Promise<Bill> =>
  dataOf(await asUser<sales.SaleResult>(t.h.url, t.cashier, sales.CREATE_SALE, { input }))
    .createSale.order;

/**
 * Three bills and a refund today (hand-computed):
 * S1 pens 2 × 100, flat −10 → 190.00 cash; S2 ink 50 + 10 % tax + 18 % GST → 64.90 card;
 * S3 pens 1 → 100.00 Udhaar; refund 1 pen of S1 → 95.00. Net 259.90, tax 5.00 + 9.90.
 */
export async function seedDashboardDay(t: RoleHarness) {
  const ids = { pens: '', ink: '', s2: '' };
  const today = t.h.app.get(ClockService).businessDate();
  ids.pens = await sales.seedProduct(t.prisma, { name: 'Dash Pens', price: '100' });
  ids.ink = await sales.seedProduct(t.prisma, { name: 'Dash Ink', price: '50', taxRate: '10' });
  const glue = await sales.seedProduct(t.prisma, { name: 'Dash Glue', price: '10', stock: -5 });
  const old = await sales.seedProduct(t.prisma, { name: 'Dash Old', price: '999' });
  for (const [id, costPrice] of [
    [ids.pens, '60'],
    [ids.ink, '30'],
    [glue, '5'],
  ] as const) {
    await t.prisma.product.update({ where: { id }, data: { costPrice }, select: { id: true } });
  }
  await t.prisma.product.update({
    where: { id: old },
    data: { archivedAt: new Date(Date.UTC(2026, 0, 1)) },
    select: { id: true },
  });
  const buyer = await khata.createCustomer(t.h.url, t.cashier, { name: 'Dues Customer' });
  const advance = await khata.createCustomer(t.h.url, t.cashier, { name: 'Advance Customer' });
  await asUser(t.h.url, t.cashier, khata.RECEIVE_PAYMENT, {
    input: khata.entryInput({ customerId: advance.id, amount: '50', method: 'CASH' }),
  });

  const s1 = await sell(
    t,
    sales.saleInput([{ productId: ids.pens, quantity: 2 }], {
      discount: { type: 'FLAT', amount: '10' },
      expectedTotal: '190.00',
    }),
  );
  ids.s2 = (
    await sell(
      t,
      sales.saleInput([{ productId: ids.ink }], {
        paymentMethod: 'CARD',
        billGst: { applied: true, rate: '18' },
        expectedTotal: '64.90',
      }),
    )
  ).id;
  await sell(
    t,
    sales.saleInput([{ productId: ids.pens }], {
      paymentMethod: 'UDHAAR',
      customerId: buyer.id,
      expectedTotal: '100.00',
    }),
  );
  const detail = await asUser<{ order: { lines: { id: string }[] } }>(
    t.h.url,
    t.cashier,
    sales.ORDER,
    { id: s1.id },
  );
  const lineId = dataOf(detail).order.lines[0]?.id;
  const refund = await asUser<sales.RefundResult>(t.h.url, t.cashier, sales.REFUND, {
    input: {
      idempotencyKey: randomUUID(),
      orderId: s1.id,
      lines: [{ orderLineId: lineId, quantity: 1 }],
      expectedAmount: '95.00',
    },
  });
  expect(dataOf(refund).refundOrder.refund.amount).toBe('95.00');
  return { today, ids };
}
