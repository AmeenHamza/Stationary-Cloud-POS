import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { PRISMA_CLIENT, type AppPrismaClient } from '../src/infrastructure/prisma/prisma.module';
import { OutboxPublisher } from '../src/infrastructure/realtime/outbox.publisher';
import { SaleEvents } from '../src/modules/sales/application/sale-events';

import { createUser, loginCookie } from './support/auth';
import { dataOf, errorCode } from './support/graphql-client';
import { startHarness, type Harness } from './support/harness';
import * as khata from './support/khata';
import { useRoles } from './support/roles';
import * as sales from './support/sales';
import { asUser } from './support/staff';

/** Row counts a failed sale must leave untouched (FIN-20). */
async function footprint(prisma: AppPrismaClient) {
  const counters = await prisma.billNumberCounter.aggregate({ _sum: { lastValue: true } });
  return {
    orders: await prisma.order.count(),
    lines: await prisma.orderLine.count(),
    movements: await prisma.stockMovement.count(),
    outbox: await prisma.outboxEvent.count(),
    ledger: await prisma.customerLedgerEntry.count(),
    counters: counters._sum.lastValue ?? 0,
  };
}

describe('a sale failing late rolls back completely (FIN-20, ADR-009)', () => {
  const t = useRoles();

  it('leaves no order, lines, movements, khata entry, counter step or outbox row', async () => {
    const id = await sales.seedProduct(t.prisma, { price: '10' });
    const customer = await khata.createCustomer(t.h.url, t.cashier, { name: 'Failpoint Buyer' });
    const before = await footprint(t.prisma);
    // The failpoint: the last step of the transaction, after stock and khata were written.
    const spy = vi
      .spyOn(t.h.app.get(SaleEvents), 'orderCreated')
      .mockRejectedValueOnce(new Error('failpoint'));
    const input = sales.saleInput([{ productId: id }], {
      paymentMethod: 'UDHAAR',
      customerId: customer.id,
      expectedTotal: '10.00',
    });
    const failed = await asUser(t.h.url, t.cashier, sales.CREATE_SALE, { input });
    expect(errorCode(failed)).toBe('INTERNAL_SERVER_ERROR');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(await footprint(t.prisma)).toEqual(before);
    expect(await sales.stockOf(t.prisma, id)).toBe(100);
    const after = await t.prisma.customer.findUnique({
      where: { id: customer.id },
      select: { balance: true },
    });
    expect(after?.balance.toString()).toBe('0');
    spy.mockRestore();
  });
});

describe('billing while Redis is down (RED-01, rule 5)', () => {
  let h: Harness;
  let prisma: AppPrismaClient;
  let cashier: string;

  beforeAll(async () => {
    h = await startHarness();
    prisma = h.app.get<AppPrismaClient>(PRISMA_CLIENT);
    cashier = await loginCookie(h.url, await createUser(h, { username: 'red01', role: 'CASHIER' }));
  });
  afterAll(async () => {
    await h.stop();
  });

  it('sells, refunds and takes a khata payment; events wait in the outbox, then drain', async () => {
    const id = await sales.seedProduct(prisma, { price: '25' });
    const customer = await khata.createCustomer(h.url, cashier, { name: 'Redis Down Buyer' });
    await h.app.get(OutboxPublisher).drain();
    await h.cutRedis();

    const sale = await asUser<sales.SaleResult>(h.url, cashier, sales.CREATE_SALE, {
      input: sales.saleInput([{ productId: id, quantity: 2 }], { expectedTotal: '50.00' }),
    });
    const orderId = dataOf(sale).createSale.order.id;
    const refunded = await asUser<sales.RefundResult>(h.url, cashier, sales.REFUND, {
      input: { ...khata.entryInput({ orderId, refundAll: true }), expectedAmount: '50.00' },
    });
    expect(dataOf(refunded).refundOrder.order.status).toBe('REFUNDED');
    const paid = await asUser<{ receiveCustomerPayment: khata.PartyNode }>(
      h.url,
      cashier,
      khata.RECEIVE_PAYMENT,
      { input: khata.entryInput({ customerId: customer.id, amount: '10', method: 'CASH' }) },
    );
    expect(dataOf(paid).receiveCustomerPayment.balance).toBe('-10.00');
    const waiting = () => prisma.outboxEvent.count({ where: { publishedAt: null } });
    expect(await waiting()).toBeGreaterThanOrEqual(5); // stock ×2, order ×2, balance

    h.redisProxy.restore();
    await h.redisReady();
    await h.app.get(OutboxPublisher).drain();
    expect(await waiting()).toBe(0);
  });
});
