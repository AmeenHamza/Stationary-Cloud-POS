import { preflight } from './preflight.js';
import { writeCatalog } from './write-catalog.js';
import { writeLedgers } from './write-ledgers.js';
import { writeCounters, writeOrders } from './write-orders.js';
import { writeBalances, writeParties } from './write-parties.js';

import type { StepResult, WriteContext } from './step.js';
import type { MigrationPlan } from '../transform/plan.js';

/** Every table the migration writes; locked for the run so the app cannot write in between. */
const TABLES = `categories, products, stock_movements, customers, vendors, orders, order_lines,
  refunds, refund_lines, customer_ledger_entries, vendor_ledger_entries, bill_number_counters,
  import_jobs`;

/** The new database is not ready: nothing was written. */
export class PreflightError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(problems.join(' '));
  }
}

/**
 * Writes the whole plan inside the caller's open transaction, in dependency order (MAPPING.md §6).
 * The tables are locked first and the new database checked again under the lock, so nothing can
 * slip in between the check and the writes. The caller validates, then commits or rolls back.
 */
export async function writePlan(context: WriteContext, plan: MigrationPlan): Promise<StepResult[]> {
  const { client } = context;
  await client.query("SET LOCAL lock_timeout = '15s'");
  await client.query("SET LOCAL statement_timeout = '10min'");
  await client.query(`LOCK TABLE ${TABLES} IN SHARE ROW EXCLUSIVE MODE`);
  const check = await preflight(client);
  if (check.problems.length > 0) {
    throw new PreflightError(check.problems);
  }
  context.log.info('The new database is ready; writing', check.migrated);
  return [
    ...(await writeCatalog(context, plan.categories, plan.products)),
    ...(await writeParties(context, plan.customers, plan.vendors)),
    ...(await writeOrders(context, plan.orders)),
    ...(await writeLedgers(context, plan.customerEntries, plan.vendorEntries)),
    ...(await writeBalances(context)),
    await writeCounters(context, plan.counters),
  ];
}
