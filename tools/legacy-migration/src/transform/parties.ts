import { normalizeNameKey, phoneDigits } from '@pos/domain';

import { capped, legacyUuid } from './values.js';

import type { Issues } from './issues.js';
import type { LegacyRow } from '../legacy/schema-map.js';

/** A customer or vendor; the balance is set from its ledger after the entries are written. */
export interface PartyPlan {
  id: string;
  legacyId: string;
  name: string;
  nameKey: string;
  phone: string | null;
  phoneDigits: string | null;
  email: string | null;
  address: string | null;
  productsSupplied: string | null;
}

type PartyRow = LegacyRow<'customers'> & Partial<LegacyRow<'vendors'>>;

/**
 * Customers (`kind` customer) or vendors, in id order. Loyalty points and total purchases are not
 * migrated: the new system has neither (Q39); purchases are recomputed from the migrated bills.
 */
export function planParties(
  kind: 'customer' | 'vendor',
  rows: readonly PartyRow[],
  issues: Issues,
): { parties: PartyPlan[]; idOf: Map<string, string> } {
  const table = kind === 'customer' ? 'customers' : 'vendors';
  const idOf = new Map<string, string>();
  const parties = rows.map((row) => {
    const legacyId = row.id ?? '';
    const ref = `${table}#${legacyId}`;
    const name = capped(row.name, 120, issues, ref, 'name') ?? `${kind} ${legacyId}`;
    const phone = capped(row.phone, 30, issues, ref, 'phone');
    const plan: PartyPlan = {
      id: legacyUuid(kind, legacyId),
      legacyId,
      name,
      nameKey: normalizeNameKey(name),
      phone,
      phoneDigits: phoneDigits(phone)?.slice(0, 20) ?? null,
      email: capped(row.email, 254, issues, ref, 'email'),
      address: capped(row.address, 300, issues, ref, 'address'),
      productsSupplied:
        kind === 'vendor'
          ? capped(row.productsSupplied ?? null, 300, issues, ref, 'products supplied')
          : null,
    };
    idOf.set(legacyId, plan.id);
    return plan;
  });
  return { parties, idOf };
}
