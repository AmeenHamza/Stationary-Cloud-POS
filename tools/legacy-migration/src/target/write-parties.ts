import { insertRows } from './insert.js';
import { checkpoint, columns, type StepResult, type WriteContext } from './step.js';

import type { PartyPlan } from '../transform/parties.js';

/** Customers and vendors with balance 0; `writeBalances` sets it once their entries are written. */
export async function writeParties(
  context: WriteContext,
  customers: readonly PartyPlan[],
  vendors: readonly PartyPlan[],
): Promise<StepResult[]> {
  const at = (party: PartyPlan): Date => party.createdAt ?? context.runAt;
  const contact = (p: PartyPlan) => [p.id, p.legacyId, p.name, p.nameKey, p.phone, p.phoneDigits];
  const newCustomers = await insertRows(
    context.client,
    {
      table: 'customers',
      columns: columns(
        'id legacy_id name name_key phone phone_digits email address created_at updated_at',
      ),
      conflict: '(id)',
    },
    customers.map((p) => [...contact(p), p.email, p.address, at(p), at(p)]),
    context.batchSize,
  );
  const newVendors = await insertRows(
    context.client,
    {
      table: 'vendors',
      columns: columns(`id legacy_id name name_key phone phone_digits email address
        products_supplied created_at updated_at`),
      conflict: '(id)',
    },
    vendors.map((p) => [...contact(p), p.email, p.address, p.productsSupplied, at(p), at(p)]),
    context.batchSize,
  );
  return [
    checkpoint(context, 'customers', newCustomers),
    checkpoint(context, 'vendors', newVendors),
  ];
}

/**
 * Sets each migrated customer's and vendor's balance to Σ of its entries (DATABASE.md §12), so the
 * khata integrity check holds. Only migrated parties whose balance differs are touched.
 */
export async function writeBalances(context: WriteContext): Promise<StepResult[]> {
  const results: StepResult[] = [];
  for (const [table, entries, key] of [
    ['customers', 'customer_ledger_entries', 'customer_id'],
    ['vendors', 'vendor_ledger_entries', 'vendor_id'],
  ] as const) {
    const response = await context.client.query(
      `UPDATE "${table}" p SET balance = s.total
       FROM (SELECT ${key} AS party_id, sum(amount) AS total FROM "${entries}" GROUP BY ${key}) s
       WHERE s.party_id = p.id AND p.legacy_id IS NOT NULL AND p.balance <> s.total`,
    );
    const updated = response.rowCount ?? 0;
    results.push(checkpoint(context, `${table}.balance`, { planned: updated, inserted: updated }));
  }
  return results;
}
