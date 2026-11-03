import { Injectable } from '@nestjs/common';

import { LedgerPosting } from '../../ledger/ledger-posting.service';
import { contactData, PartyCommands } from '../../ledger/party-commands.service';
import { PartyQueries } from '../../ledger/party-queries.service';
import { PartyService } from '../../ledger/party.service';
import {
  CustomersRepository,
  type CustomerEntryRow,
  type CustomerRow,
} from '../persistence/customers.repository';

import type { Principal } from '../../../../common/auth/principal';
import type { PartyContact } from '../../ledger/party-store';
import type {
  AddCustomerCreditInput,
  CreateCustomerInput,
  ReceiveCustomerPaymentInput,
} from '@pos/validation';

/**
 * Customers and their khata (F-25, D-11). Manual Udhaar and payments are posted here; credit sales
 * and refund credits are posted by billing through `postCreditSale` / `postRefundCredit`.
 */
@Injectable()
export class CustomersService extends PartyService<
  CustomerRow,
  PartyContact,
  CustomerEntryRow,
  CreateCustomerInput
> {
  constructor(
    store: CustomersRepository,
    queries: PartyQueries,
    commands: PartyCommands,
    posting: LedgerPosting,
  ) {
    super(store, { queries, commands, posting });
  }

  protected toData(input: CreateCustomerInput): PartyContact {
    return contactData(input);
  }

  /** "Add Udhaar (Goods on Credit)" [K] (Q25): raises what the customer owes. */
  addCredit(input: AddCustomerCreditInput, viewer: Principal): Promise<CustomerRow> {
    return this.postManual(input.customerId, input, viewer, {
      type: 'MANUAL_CREDIT',
      raisesBalance: true,
      paymentMethod: null,
      note: input.note,
      audit: 'customer.creditAdded',
    });
  }

  /** An Udhaar bill: the whole total goes to the khata (D-15, BR-10), in the sale's transaction. */
  postCreditSale(
    customerId: string,
    orderId: string,
    total: string,
    actorUserId: string,
  ): Promise<CustomerRow> {
    return this.posting.post(
      this.store,
      {
        partyId: customerId,
        type: 'CREDIT_SALE',
        amount: total,
        raisesBalance: true,
        paymentMethod: null,
        note: null,
        orderId,
        requireActive: true,
        idempotencyKey: null,
        requestHash: null,
        audit: null,
      },
      actorUserId,
    );
  }

  /** Refunding an Udhaar bill credits the khata instead of paying cash (A-03), even if archived. */
  postRefundCredit(
    customerId: string,
    refundId: string,
    amount: string,
    actorUserId: string,
  ): Promise<CustomerRow> {
    return this.posting.post(
      this.store,
      {
        partyId: customerId,
        type: 'REFUND_CREDIT',
        amount,
        raisesBalance: false,
        paymentMethod: null,
        note: null,
        refundId,
        requireActive: false,
        idempotencyKey: null,
        requestHash: null,
        audit: null,
      },
      actorUserId,
    );
  }

  /** "Receive Payment" [K] (BR-11): lowers the balance; below zero is an advance (Q25). */
  receivePayment(input: ReceiveCustomerPaymentInput, viewer: Principal): Promise<CustomerRow> {
    return this.postManual(input.customerId, input, viewer, {
      type: 'PAYMENT',
      raisesBalance: false,
      paymentMethod: input.method,
      note: input.note,
      audit: 'customer.paymentReceived',
    });
  }
}
