import { describe, expect, it } from 'vitest';

import { errorCode } from './support/graphql-client';
import * as khata from './support/khata';
import { useRoles } from './support/roles';
import { asUser } from './support/staff';

const t = useRoles();

interface PartyPage {
  customers: { nodes: khata.PartyNode[]; totalCount: number };
}

const list = (filter: Record<string, unknown>, cookie = t.cashier) =>
  asUser<PartyPage>(t.h.url, cookie, khata.CUSTOMERS, { filter });

const credit = (customerId: string, amount: string, cookie = t.cashier) =>
  asUser<{ addCustomerCredit: khata.PartyNode }>(t.h.url, cookie, khata.ADD_CREDIT, {
    input: khata.entryInput({ customerId, amount }),
  });

const pay = (input: Record<string, unknown>, cookie = t.cashier) =>
  asUser<{ receiveCustomerPayment: khata.PartyNode }>(t.h.url, cookie, khata.RECEIVE_PAYMENT, {
    input,
  });

describe('customers (F-25, D-11)', () => {
  it('lets a cashier add, edit and find customers by name or phone digits', async () => {
    const ali = await khata.createCustomer(t.h.url, t.cashier, {
      name: 'Ali Traders',
      phone: '0300-111 2233',
      email: '',
      address: null,
    });
    expect(ali).toMatchObject({ name: 'Ali Traders', balance: '0.00', version: 1 });
    await khata.createCustomer(t.h.url, t.cashier, { name: 'Bilal Books', phone: '0311 4445566' });

    const byName = khata.dataOf(await list({ search: 'ali tr' })).customers;
    expect(byName.nodes.map((node) => node.name)).toEqual(['Ali Traders']);
    const byPhone = khata.dataOf(await list({ search: '4445566' })).customers;
    expect(byPhone.nodes.map((node) => node.name)).toEqual(['Bilal Books']);

    const updated = await asUser<{ updateCustomer: khata.PartyNode }>(
      t.h.url,
      t.cashier,
      khata.UPDATE_CUSTOMER,
      { input: { id: ali.id, version: 1, name: 'Ali Traders Co', phone: null } },
    );
    expect(khata.dataOf(updated).updateCustomer).toMatchObject({
      name: 'Ali Traders Co',
      phone: null,
    });
    const stale = await asUser(t.h.url, t.cashier, khata.UPDATE_CUSTOMER, {
      input: { id: ali.id, version: 1, name: 'Again' },
    });
    expect(errorCode(stale)).toBe('CONFLICT');
  });

  it('keeps a running balance: Udhaar raises it, payments lower it, below zero is an advance', async () => {
    const customer = await khata.createCustomer(t.h.url, t.cashier, { name: 'Running Ledger' });
    expect(khata.dataOf(await credit(customer.id, '1500.50')).addCustomerCredit.balance).toBe(
      '1500.50',
    );
    const paid = await pay(
      khata.entryInput({
        customerId: customer.id,
        amount: '2000',
        method: 'EASYPAISA',
        note: 'Full',
      }),
    );
    expect(khata.dataOf(paid).receiveCustomerPayment.balance).toBe('-499.50'); // advance (Q25)

    const ledger = await asUser<{ customerLedger: { nodes: khata.EntryNode[] } }>(
      t.h.url,
      t.cashier,
      khata.CUSTOMER_LEDGER,
      { customerId: customer.id },
    );
    expect(khata.dataOf(ledger).customerLedger.nodes).toMatchObject([
      { type: 'PAYMENT', amount: '-2000.00', balanceAfter: '-499.50', paymentMethod: 'EASYPAISA' },
      { type: 'MANUAL_CREDIT', amount: '1500.50', balanceAfter: '1500.50', paymentMethod: null },
    ]);
  });

  it('applies a retried entry once and refuses its key with other details', async () => {
    const customer = await khata.createCustomer(t.h.url, t.cashier, { name: 'Retry Case' });
    const input = khata.entryInput({ customerId: customer.id, amount: '300', method: 'CASH' });
    await pay(input);
    const again = khata.dataOf(await pay(input)).receiveCustomerPayment;
    expect(again.balance).toBe('-300.00');
    expect(errorCode(await pay({ ...input, amount: '301' }))).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(errorCode(await pay({ ...input, method: 'UDHAAR' }))).toBe('BAD_USER_INPUT');
  });

  it('keeps the balance chain consistent under concurrent payments (FIN-21)', async () => {
    const customer = await khata.createCustomer(t.h.url, t.cashier, { name: 'Busy Khata' });
    await credit(customer.id, '1000');
    const payments = Array.from({ length: 10 }, () =>
      pay(khata.entryInput({ customerId: customer.id, amount: '10', method: 'CASH' })),
    );
    const results = await Promise.all(payments);
    expect(results.every((response) => response.body.errors === undefined)).toBe(true);
    const rows = await t.prisma.customerLedgerEntry.findMany({
      where: { customerId: customer.id },
      orderBy: { id: 'asc' },
      select: { amount: true, balanceAfter: true },
    });
    let running = 0;
    for (const row of rows) {
      running += Math.round(Number(row.amount) * 100);
      expect(Math.round(Number(row.balanceAfter) * 100)).toBe(running);
    }
    expect(running).toBe(90_000); // 1,000 − 10 × 10, in paisa
  });

  it('archives only settled customers, admins only (Q33), and hides them by default', async () => {
    const customer = await khata.createCustomer(t.h.url, t.cashier, { name: 'Archive Me' });
    await credit(customer.id, '50');
    const archive = (cookie: string) =>
      asUser(t.h.url, cookie, khata.ARCHIVE_CUSTOMER, { id: customer.id });
    expect(errorCode(await archive(t.cashier))).toBe('FORBIDDEN');
    expect(errorCode(await archive(t.admin))).toBe('BALANCE_NOT_ZERO');
    await pay(khata.entryInput({ customerId: customer.id, amount: '50', method: 'CARD' }));
    expect(errorCode(await archive(t.admin))).toBeUndefined();

    expect(khata.dataOf(await list({ search: 'archive me' })).customers.totalCount).toBe(0);
    const all = khata.dataOf(await list({ search: 'archive me', includeArchived: true })).customers;
    expect(all.nodes[0]?.archivedAt).not.toBeNull();
    expect(errorCode(await credit(customer.id, '5'))).toBe('NOT_FOUND'); // no entries while archived
    await asUser(t.h.url, t.admin, khata.RESTORE_CUSTOMER, { id: customer.id });
    expect(errorCode(await credit(customer.id, '5'))).toBeUndefined();
  });
});
