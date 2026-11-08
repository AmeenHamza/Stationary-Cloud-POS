import { describe, expect, it } from 'vitest';

import { dataOf, errorCode } from './support/graphql-client';
import * as khata from './support/khata';
import { useRoles } from './support/roles';
import * as sales from './support/sales';
import { asUser } from './support/staff';

const t = useRoles();

const DELETE_CUSTOMER = 'mutation D($id: ID!) { deleteCustomer(id: $id) }';
const DELETE_VENDOR = 'mutation D($id: ID!) { deleteVendor(id: $id) }';

const contact = (name: string) => ({ name, phone: null, email: null, address: null });

const removeCustomer = (id: string, cookie = t.admin) =>
  asUser<{ deleteCustomer: boolean }>(t.h.url, cookie, DELETE_CUSTOMER, { id });
const removeVendor = (id: string, cookie = t.admin) =>
  asUser<{ deleteVendor: boolean }>(t.h.url, cookie, DELETE_VENDOR, { id });

const newVendor = async (name: string) =>
  dataOf(
    await asUser<{ createVendor: khata.PartyNode }>(t.h.url, t.admin, khata.CREATE_VENDOR, {
      input: { ...contact(name), productsSupplied: null },
    }),
  ).createVendor;

const customerExists = async (id: string): Promise<boolean> =>
  (await t.prisma.customer.findUnique({ where: { id }, select: { id: true } })) !== null;

describe('deleteCustomer (D-28)', () => {
  it('removes a customer with no bills or entries from the database', async () => {
    const customer = await khata.createCustomer(t.h.url, t.admin, contact('Never bought'));
    expect(dataOf(await removeCustomer(customer.id)).deleteCustomer).toBe(true);
    expect(await customerExists(customer.id)).toBe(false);
    const audit = await t.prisma.auditLog.findFirst({
      where: { action: 'customer.deleted', entityId: customer.id },
      select: { metadata: true },
    });
    expect(audit).not.toBeNull();
    expect(errorCode(await removeCustomer(customer.id))).toBe('NOT_FOUND');
  });

  it('refuses a customer with khata entries, even once settled and archived (D-12)', async () => {
    const customer = await khata.createCustomer(t.h.url, t.admin, contact('Settled up'));
    const entry = { customerId: customer.id, amount: '40.00', note: null };
    await asUser(t.h.url, t.admin, khata.ADD_CREDIT, { input: khata.entryInput(entry) });
    expect(errorCode(await removeCustomer(customer.id))).toBe('HAS_HISTORY');
    await asUser(t.h.url, t.admin, khata.RECEIVE_PAYMENT, {
      input: khata.entryInput({ ...entry, method: 'CASH' }),
    });
    await asUser(t.h.url, t.admin, khata.ARCHIVE_CUSTOMER, { id: customer.id });
    expect(errorCode(await removeCustomer(customer.id))).toBe('HAS_HISTORY');
    expect(await t.prisma.customerLedgerEntry.count({ where: { customerId: customer.id } })).toBe(
      2,
    );
  });

  it('refuses a customer with an Udhaar bill', async () => {
    const customer = await khata.createCustomer(t.h.url, t.admin, contact('On credit'));
    const productId = await sales.seedProduct(t.prisma, { price: '25' });
    dataOf(
      await sales.sellAsCashier(
        t,
        sales.saleInput([{ productId }], {
          paymentMethod: 'UDHAAR',
          customerId: customer.id,
          expectedTotal: '25.00',
        }),
      ),
    );
    expect(errorCode(await removeCustomer(customer.id))).toBe('HAS_HISTORY');
    expect(await customerExists(customer.id)).toBe(true);
  });

  it('is for admins only, though cashiers keep khata (D-11)', async () => {
    const customer = await khata.createCustomer(t.h.url, t.cashier, contact('Till added'));
    expect(errorCode(await removeCustomer(customer.id, t.cashier))).toBe('FORBIDDEN');
    expect(await customerExists(customer.id)).toBe(true);
  });
});

describe('deleteVendor (D-28)', () => {
  it('removes a vendor with no entries from the database', async () => {
    const vendor = await newVendor('Unused supplier');
    expect(dataOf(await removeVendor(vendor.id)).deleteVendor).toBe(true);
    expect(
      await t.prisma.vendor.findUnique({ where: { id: vendor.id }, select: { id: true } }),
    ).toBeNull();
    expect(errorCode(await removeVendor(vendor.id))).toBe('NOT_FOUND');
  });

  it('refuses a vendor with khata entries (D-12), and cashiers', async () => {
    const vendor = await newVendor('Regular supplier');
    await asUser(t.h.url, t.admin, khata.ADD_PURCHASE, {
      input: khata.entryInput({ vendorId: vendor.id, amount: '900.00', description: 'Paper' }),
    });
    expect(errorCode(await removeVendor(vendor.id))).toBe('HAS_HISTORY');
    expect(errorCode(await removeVendor(vendor.id, t.cashier))).toBe('FORBIDDEN');
    expect(await t.prisma.vendorLedgerEntry.count({ where: { vendorId: vendor.id } })).toBe(1);
  });
});
