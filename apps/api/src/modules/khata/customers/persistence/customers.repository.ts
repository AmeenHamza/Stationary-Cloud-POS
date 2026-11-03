import { Injectable } from '@nestjs/common';

import { keysetOrderBy } from '../../../../common/pagination/keyset';
import { TransactionalClient } from '../../../../infrastructure/prisma/transactional-client';
import { LEDGER_ORDER, ledgerWhere, PARTY_SORT, partyWhere } from '../../ledger/party-where';

import type {
  LedgerWindow,
  NewLedgerEntry,
  PartyContact,
  PartyFilter,
  PartyStore,
} from '../../ledger/party-store';
import type { Prisma } from '@pos/database';

export const CUSTOMER_SELECT = {
  id: true,
  name: true,
  phone: true,
  email: true,
  address: true,
  balance: true,
  archivedAt: true,
  version: true,
  createdAt: true,
} as const satisfies Prisma.CustomerSelect;

export type CustomerRow = Prisma.CustomerGetPayload<{ select: typeof CUSTOMER_SELECT }>;

export const CUSTOMER_ENTRY_SELECT = {
  id: true,
  type: true,
  amount: true,
  balanceAfter: true,
  paymentMethod: true,
  note: true,
  orderId: true,
  refundId: true,
  businessDate: true,
  createdAt: true,
} as const satisfies Prisma.CustomerLedgerEntrySelect;

export type CustomerEntryRow = Prisma.CustomerLedgerEntryGetPayload<{
  select: typeof CUSTOMER_ENTRY_SELECT;
}>;

/** `customers` and `customer_ledger_entries` (DATABASE.md §4.7–4.8) behind the shared khata store. */
@Injectable()
export class CustomersRepository implements PartyStore<
  CustomerRow,
  PartyContact,
  CustomerEntryRow
> {
  readonly kind = 'customer';

  constructor(private readonly db: TransactionalClient) {}

  list(filter: PartyFilter, take: number, after: string | null | undefined) {
    return this.db.client.customer.findMany({
      where: partyWhere(filter, after),
      orderBy: keysetOrderBy(PARTY_SORT),
      take,
      select: { ...CUSTOMER_SELECT, nameKey: true },
    });
  }

  count(filter: PartyFilter): Promise<number> {
    return this.db.client.customer.count({
      where: partyWhere(filter, null),
    });
  }

  findById(id: string): Promise<CustomerRow | null> {
    return this.db.client.customer.findUnique({ where: { id }, select: CUSTOMER_SELECT });
  }

  insert(data: PartyContact): Promise<CustomerRow> {
    return this.db.client.customer.create({ data, select: CUSTOMER_SELECT });
  }

  update(id: string, version: number, data: PartyContact): Promise<CustomerRow> {
    return this.db.client.customer.update({
      where: { id, version },
      data: { ...data, version: { increment: 1 } },
      select: CUSTOMER_SELECT,
    });
  }

  setArchivedAt(id: string, version: number, archivedAt: Date | null): Promise<CustomerRow> {
    return this.db.client.customer.update({
      where: { id, version },
      data: { archivedAt, version: { increment: 1 } },
      select: CUSTOMER_SELECT,
    });
  }

  applyDelta(id: string, delta: string, requireActive: boolean): Promise<CustomerRow> {
    return this.db.client.customer.update({
      where: requireActive ? { id, archivedAt: null } : { id },
      data: { balance: { increment: delta }, version: { increment: 1 } },
      select: CUSTOMER_SELECT,
    });
  }

  async insertEntry(entry: NewLedgerEntry): Promise<void> {
    const { partyId, type, ...fields } = entry;
    await this.db.client.customerLedgerEntry.create({
      data: {
        ...fields,
        customerId: partyId,
        type: type as Prisma.CustomerLedgerEntryCreateInput['type'],
      },
      select: { id: true },
    });
  }

  async findEntryByKey(key: string) {
    const row = await this.db.client.customerLedgerEntry.findUnique({
      where: { idempotencyKey: key },
      select: { customerId: true, requestHash: true },
    });
    return row?.requestHash == null
      ? null
      : { requestHash: row.requestHash, partyId: row.customerId };
  }

  listEntries(partyId: string, window: LedgerWindow): Promise<CustomerEntryRow[]> {
    return this.db.client.customerLedgerEntry.findMany({
      where: ledgerWhere('customerId', partyId, window),
      orderBy: [...LEDGER_ORDER],
      take: window.take,
      select: CUSTOMER_ENTRY_SELECT,
    });
  }

  countEntries(partyId: string, since: Date | null): Promise<number> {
    const window = { since, take: 0, cursor: null };
    return this.db.client.customerLedgerEntry.count({
      where: ledgerWhere('customerId', partyId, window),
    });
  }
}
