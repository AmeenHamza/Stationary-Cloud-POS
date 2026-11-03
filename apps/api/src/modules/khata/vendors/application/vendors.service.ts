import { Injectable } from '@nestjs/common';

import { LedgerPosting } from '../../ledger/ledger-posting.service';
import { contactData, PartyCommands } from '../../ledger/party-commands.service';
import { PartyQueries } from '../../ledger/party-queries.service';
import { PartyService } from '../../ledger/party.service';
import {
  VendorsRepository,
  type VendorData,
  type VendorEntryRow,
  type VendorRow,
} from '../persistence/vendors.repository';

import type { Principal } from '../../../../common/auth/principal';
import type { AddVendorPurchaseInput, CreateVendorInput, PayVendorInput } from '@pos/validation';

/**
 * Vendors and the supplier khata (F-26, D-11). A purchase is an amount and a description only and
 * never touches stock (D-20); restocking stays a separate catalogue action.
 */
@Injectable()
export class VendorsService extends PartyService<
  VendorRow,
  VendorData,
  VendorEntryRow,
  CreateVendorInput
> {
  constructor(
    store: VendorsRepository,
    queries: PartyQueries,
    commands: PartyCommands,
    posting: LedgerPosting,
  ) {
    super(store, { queries, commands, posting });
  }

  protected toData(input: CreateVendorInput): VendorData {
    return { ...contactData(input), productsSupplied: input.productsSupplied };
  }

  /** "Add Purchase (Maal Khareeda)" [K] (BR-12): raises what the shop owes. */
  addPurchase(input: AddVendorPurchaseInput, viewer: Principal): Promise<VendorRow> {
    return this.postManual(input.vendorId, input, viewer, {
      type: 'PURCHASE',
      raisesBalance: true,
      paymentMethod: null,
      note: input.description,
      audit: 'vendor.purchaseAdded',
    });
  }

  /** "Make Payment / Installment" [K] (BR-12): lowers what the shop owes. */
  pay(input: PayVendorInput, viewer: Principal): Promise<VendorRow> {
    return this.postManual(input.vendorId, input, viewer, {
      type: 'PAYMENT',
      raisesBalance: false,
      paymentMethod: input.method,
      note: input.note,
      audit: 'vendor.paymentMade',
    });
  }
}
