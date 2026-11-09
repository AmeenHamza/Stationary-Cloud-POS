import { fixed, insertRows } from './insert.js';
import { checkpoint, columns, type StepResult, type WriteContext } from './step.js';

import type { LedgerPlan } from '../transform/ledgers.js';
import type { CustomerEntryType, VendorEntryType } from '@pos/contracts';

/** Re-runs skip entries already written: `legacy_id` is unique on both ledgers. */
const BY_LEGACY_ID = '(legacy_id) WHERE legacy_id IS NOT NULL';

const SHARED = 'type amount balance_after payment_method note business_date created_at legacy_id';

const shared = (e: LedgerPlan<string>) => [
  ...[e.type, fixed(e.amount), fixed(e.balanceAfter), e.paymentMethod, e.note],
  ...[e.businessDate, e.createdAt, e.legacyId],
];

/** Both khata ledgers, each in time order with running balances (written after bills and refunds). */
export async function writeLedgers(
  context: WriteContext,
  customerEntries: readonly LedgerPlan<CustomerEntryType>[],
  vendorEntries: readonly LedgerPlan<VendorEntryType>[],
): Promise<StepResult[]> {
  const customers = await insertRows(
    context.client,
    {
      table: 'customer_ledger_entries',
      columns: columns(`customer_id order_id refund_id ${SHARED}`),
      conflict: BY_LEGACY_ID,
    },
    customerEntries.map((e) => [e.partyId, e.orderId, e.refundId, ...shared(e)]),
    context.batchSize,
  );
  const vendors = await insertRows(
    context.client,
    {
      table: 'vendor_ledger_entries',
      columns: columns(`vendor_id ${SHARED}`),
      conflict: BY_LEGACY_ID,
    },
    vendorEntries.map((e) => [e.partyId, ...shared(e)]),
    context.batchSize,
  );
  return [
    checkpoint(context, 'customer_ledger_entries', customers),
    checkpoint(context, 'vendor_ledger_entries', vendors),
  ];
}
