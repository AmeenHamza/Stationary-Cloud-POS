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

export const VENDOR_SELECT = {
  id: true,
  name: true,
  phone: true,
  email: true,
  address: true,
  productsSupplied: true,
  balance: true,
  archivedAt: true,
  version: true,
  createdAt: true,
} as const satisfies Prisma.VendorSelect;

export type VendorRow = Prisma.VendorGetPayload<{ select: typeof VENDOR_SELECT }>;

/** Vendor contact plus the free-text "products supplied" (FEATURES.md §3.10). */
export type VendorData = PartyContact & { productsSupplied: string | null };

export const VENDOR_ENTRY_SELECT = {
  id: true,
  type: true,
  amount: true,
  balanceAfter: true,
  paymentMethod: true,
  note: true,
  businessDate: true,
  createdAt: true,
} as const satisfies Prisma.VendorLedgerEntrySelect;

export type VendorEntryRow = Prisma.VendorLedgerEntryGetPayload<{
  select: typeof VENDOR_ENTRY_SELECT;
}>;

/** `vendors` and `vendor_ledger_entries` (DATABASE.md §4.7–4.8) behind the shared khata store. */
@Injectable()
export class VendorsRepository implements PartyStore<VendorRow, VendorData, VendorEntryRow> {
  readonly kind = 'vendor';

  constructor(private readonly db: TransactionalClient) {}

  list(filter: PartyFilter, take: number, after: string | null | undefined) {
    const where = partyWhere(filter, after) as Prisma.VendorWhereInput;
    return this.db.client.vendor.findMany({
      where,
      orderBy: keysetOrderBy(PARTY_SORT),
      take,
      select: { ...VENDOR_SELECT, nameKey: true },
    });
  }

  count(filter: PartyFilter): Promise<number> {
    return this.db.client.vendor.count({
      where: partyWhere(filter, null),
    });
  }

  findById(id: string): Promise<VendorRow | null> {
    return this.db.client.vendor.findUnique({ where: { id }, select: VENDOR_SELECT });
  }

  insert(data: VendorData): Promise<VendorRow> {
    return this.db.client.vendor.create({ data, select: VENDOR_SELECT });
  }

  update(id: string, version: number, data: VendorData): Promise<VendorRow> {
    const changes = { ...data, version: { increment: 1 } };
    return this.db.client.vendor.update({
      where: { id, version },
      data: changes,
      select: VENDOR_SELECT,
    });
  }

  setArchivedAt(id: string, version: number, archivedAt: Date | null): Promise<VendorRow> {
    const changes = { archivedAt, version: { increment: 1 } };
    return this.db.client.vendor.update({
      where: { id, version },
      data: changes,
      select: VENDOR_SELECT,
    });
  }

  applyDelta(id: string, delta: string, requireActive: boolean): Promise<VendorRow> {
    const changes = { balance: { increment: delta }, version: { increment: 1 } };
    const where = requireActive ? { id, archivedAt: null } : { id };
    return this.db.client.vendor.update({ where, data: changes, select: VENDOR_SELECT });
  }

  /** Vendor entries have no order or refund links (DATABASE.md §4.8). */
  async insertEntry(entry: NewLedgerEntry): Promise<void> {
    await this.db.client.vendorLedgerEntry.create({
      data: {
        vendorId: entry.partyId,
        type: entry.type as Prisma.VendorLedgerEntryCreateInput['type'],
        amount: entry.amount,
        balanceAfter: entry.balanceAfter,
        paymentMethod: entry.paymentMethod,
        note: entry.note,
        idempotencyKey: entry.idempotencyKey,
        requestHash: entry.requestHash,
        actorUserId: entry.actorUserId,
      },
      select: { id: true },
    });
  }

  async findEntryByKey(key: string) {
    const row = await this.db.client.vendorLedgerEntry.findUnique({
      where: { idempotencyKey: key },
      select: { vendorId: true, requestHash: true },
    });
    return row?.requestHash == null
      ? null
      : { requestHash: row.requestHash, partyId: row.vendorId };
  }

  listEntries(partyId: string, window: LedgerWindow): Promise<VendorEntryRow[]> {
    const where = ledgerWhere('vendorId', partyId, window) as Prisma.VendorLedgerEntryWhereInput;
    return this.db.client.vendorLedgerEntry.findMany({
      where,
      orderBy: [...LEDGER_ORDER],
      take: window.take,
      select: VENDOR_ENTRY_SELECT,
    });
  }

  countEntries(partyId: string, since: Date | null): Promise<number> {
    const where = ledgerWhere('vendorId', partyId, { since, take: 0, cursor: null });
    return this.db.client.vendorLedgerEntry.count({
      where: where,
    });
  }
}
