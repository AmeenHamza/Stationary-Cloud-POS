import { describe, expect, it } from 'vitest';

import { errorCode } from './support/graphql-client';
import * as khata from './support/khata';
import { useRoles } from './support/roles';
import { asUser } from './support/staff';

const t = useRoles();

interface LedgerPage {
  customerLedger: {
    nodes: khata.EntryNode[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    totalCount: number;
  };
}

const ledger = (variables: Record<string, unknown>) =>
  asUser<LedgerPage>(t.h.url, t.cashier, khata.CUSTOMER_LEDGER, variables);

describe('vendor khata (F-26, D-20)', () => {
  it('records purchases and payments as amounts only, without touching stock', async () => {
    const created = await asUser<{ createVendor: khata.PartyNode & { productsSupplied: string } }>(
      t.h.url,
      t.cashier,
      khata.CREATE_VENDOR,
      { input: { name: 'Paper Mills', productsSupplied: 'Registers, copies' } },
    );
    const vendor = khata.dataOf(created).createVendor;
    expect(vendor.productsSupplied).toBe('Registers, copies');
    const bought = await asUser<{ addVendorPurchase: khata.PartyNode }>(
      t.h.url,
      t.cashier,
      khata.ADD_PURCHASE,
      { input: khata.entryInput({ vendorId: vendor.id, amount: '25000', description: 'Maal' }) },
    );
    expect(khata.dataOf(bought).addVendorPurchase.balance).toBe('25000.00');
    const paid = await asUser<{ payVendor: khata.PartyNode }>(
      t.h.url,
      t.cashier,
      khata.PAY_VENDOR,
      {
        input: khata.entryInput({ vendorId: vendor.id, amount: '10000', method: 'BANK_TRANSFER' }),
      },
    );
    expect(khata.dataOf(paid).payVendor.balance).toBe('15000.00');

    const entries = await asUser<{ vendorLedger: { nodes: khata.EntryNode[] } }>(
      t.h.url,
      t.cashier,
      khata.VENDOR_LEDGER,
      { vendorId: vendor.id },
    );
    expect(khata.dataOf(entries).vendorLedger.nodes).toMatchObject([
      { type: 'PAYMENT', amount: '-10000.00', balanceAfter: '15000.00' },
      { type: 'PURCHASE', amount: '25000.00', balanceAfter: '25000.00', note: 'Maal' },
    ]);
    expect(await t.prisma.stockMovement.count()).toBe(0);
  });
});

describe('ledger pages and the 90-day window (PAG-08, F-35)', () => {
  it('pages newest first and hides entries older than 90 days unless asked', async () => {
    const customer = await khata.createCustomer(t.h.url, t.cashier, { name: 'Long History' });
    await t.prisma.customerLedgerEntry.createMany({
      data: Array.from({ length: 60 }, (_, index) => ({
        customerId: customer.id,
        type: 'MANUAL_CREDIT' as const,
        amount: '1.00',
        balanceAfter: String(index + 1),
        createdAt: new Date(Date.UTC(2026, 5, 1, 0, index)),
      })),
    });
    await t.prisma.customerLedgerEntry.create({
      data: { customerId: customer.id, type: 'MANUAL_CREDIT', amount: '5', balanceAfter: '65' },
      select: { id: true },
    });

    const recent = khata.dataOf(await ledger({ customerId: customer.id })).customerLedger;
    expect(recent.nodes).toHaveLength(1); // the June rows are older than 90 days
    const first = khata.dataOf(
      await ledger({ customerId: customer.id, includeArchived: true }),
    ).customerLedger;
    expect(first.nodes.map((node) => node.balanceAfter).slice(0, 3)).toEqual([
      '65.00',
      '60.00',
      '59.00',
    ]);
    expect(first.totalCount).toBe(61);
    const second = khata.dataOf(
      await ledger({
        customerId: customer.id,
        includeArchived: true,
        after: first.pageInfo.endCursor,
      }),
    ).customerLedger;
    expect(second.nodes).toHaveLength(11);
    expect(second.pageInfo.hasNextPage).toBe(false);
    const ids = new Set([...first.nodes, ...second.nodes].map((node) => node.id));
    expect(ids.size).toBe(61);
    expect(errorCode(await ledger({ customerId: customer.id, after: 'nope' }))).toBe('BAD_CURSOR');
  });

  it('emits balance events with ids and amounts only, never names or phones (RT-01, rule 10)', async () => {
    const customer = await khata.createCustomer(t.h.url, t.cashier, {
      name: 'Private Person',
      phone: '0300 000 0000',
    });
    await asUser(t.h.url, t.cashier, khata.ADD_CREDIT, {
      input: khata.entryInput({ customerId: customer.id, amount: '75' }),
    });
    const [event] = await t.prisma.outboxEvent.findMany({
      where: { type: 'customer.balanceChanged' },
      orderBy: { seq: 'desc' },
      take: 1,
      select: { audience: true, payload: true },
    });
    expect(event).toEqual({
      audience: 'staff',
      payload: { customerId: customer.id, balance: '75.00', version: 2 },
    });
    expect(JSON.stringify(event)).not.toMatch(/Private|0300/);
  });
});
