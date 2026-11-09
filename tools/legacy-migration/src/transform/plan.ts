import { planCategories, type CategoryPlan } from './catalog.js';
import { datedRefunds, planCounters, type CounterPlan } from './counters.js';
import { Issues } from './issues.js';
import { planCustomerEntries, planVendorEntries, type LedgerPlan } from './ledgers.js';
import { cashierNames, planOrders, shopGstRate, type OrderPlan } from './orders.js';
import { planParties, type PartyPlan } from './parties.js';
import { planProducts, type ProductPlan } from './products.js';
import { text } from './values.js';

import type { LegacyData } from '../legacy/reader.js';
import type { LegacyEntity } from '../legacy/schema-map.js';
import type { CustomerEntryType, VendorEntryType } from '@pos/contracts';
import type { Decimal } from '@pos/domain';

/** Everything the migration would write, plus what it found (the dry-run report, DATABASE.md §11). */
export interface MigrationPlan {
  categories: CategoryPlan[];
  products: ProductPlan[];
  customers: PartyPlan[];
  vendors: PartyPlan[];
  orders: OrderPlan[];
  customerEntries: LedgerPlan<CustomerEntryType>[];
  vendorEntries: LedgerPlan<VendorEntryType>[];
  counters: CounterPlan[];
  /** The old default Bill GST rate, reported only: the new setting is kept (Q44). */
  shopGstRate: Decimal | null;
  issues: Issues;
  /** Old rows read per table. */
  read: Record<LegacyEntity, number>;
}

/** Groups rows by a field (items and payments by their bill). */
function groupBy<T>(rows: readonly T[], key: (row: T) => string | null): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const value = key(row) ?? '';
    groups.set(value, [...(groups.get(value) ?? []), row]);
  }
  return groups;
}

/** Turns the old data into the new records, in the order they must be written (§11 step 1). */
export function planMigration(data: LegacyData, timeZone: string): MigrationPlan {
  const issues = new Issues();
  const { categories, idOf: categoryIdOf } = planCategories(data.categories, issues);
  const products = planProducts(data.products, categoryIdOf, issues);
  const customers = planParties('customer', data.customers, issues);
  const vendors = planParties('vendor', data.vendors, issues);
  const items = groupBy(data.orderItems, (row) => text(row.orderId));
  const payments = groupBy(data.orderPayments, (row) => text(row.orderId));
  const gstRate = shopGstRate(data.systemSettings);
  const orders = planOrders(data.orders, {
    products: new Map(products.map((product) => [product.legacyId, product])),
    customerIdOf: customers.idOf,
    cashierNames: cashierNames(data.users, issues),
    itemsOf: (id) => items.get(id) ?? [],
    paymentsOf: (id) => payments.get(id) ?? [],
    shopGstRate: gstRate,
    timeZone,
    issues,
  });
  const context = { timeZone, issues };
  const customerEntries = planCustomerEntries(
    data.customerTransactions.map((row) => ({ ...row, partyId: row.customerId })),
    customers.idOf,
    new Map(orders.map((order) => [order.legacyId, order])),
    context,
  );
  const vendorEntries = planVendorEntries(
    data.vendorTransactions.map((row) => ({ ...row, partyId: row.vendorId })),
    vendors.idOf,
    context,
  );
  const read = Object.fromEntries(
    Object.entries(data).map(([entity, rows]) => [entity, rows.length]),
  ) as Record<LegacyEntity, number>;
  return {
    categories,
    products,
    customers: customers.parties,
    vendors: vendors.parties,
    orders: datedRefunds(orders, customerEntries),
    customerEntries,
    vendorEntries,
    counters: planCounters(orders),
    shopGstRate: gstRate,
    issues,
    read,
  };
}
