import { ArgsType, Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';

import {
  CustomerEntryTypeEnum,
  PaymentMethodEnum,
} from '../../../../common/graphql/enums.registry';
import { MoneyScalar } from '../../../../common/graphql/scalars';
import { ShopEvent } from '../../../../common/graphql/shop-event.interface';
import { Connection } from '../../../../common/pagination/connection.factory';
import { PageArgs } from '../../../../common/pagination/page.args';
import {
  KhataEntryInput,
  LedgerEntryFields,
  PartyContactInput,
  PartyFields,
} from '../../ledger/graphql/party.types';

import type { CustomerEntryType, PaymentMethod } from '@pos/contracts';

/** A customer with a khata (F-25). */
@ObjectType('Customer')
export class Customer extends PartyFields {}

@ObjectType('CustomerConnection')
export class CustomerConnection extends Connection(Customer) {}

@ObjectType('CustomerLedgerEntry')
export class CustomerLedgerEntry extends LedgerEntryFields {
  @Field(() => CustomerEntryTypeEnum)
  type!: CustomerEntryType;

  @Field(() => ID, { nullable: true, description: 'The Udhaar bill (CREDIT_SALE).' })
  orderId!: string | null;

  @Field(() => ID, { nullable: true, description: 'The refund (REFUND_CREDIT, A-03).' })
  refundId!: string | null;
}

@ObjectType('CustomerLedgerEntryConnection')
export class CustomerLedgerEntryConnection extends Connection(CustomerLedgerEntry) {}

/** `customer.balanceChanged` (API.md §7.2): patch `Customer.balance` when `version` is newer. */
@ObjectType('CustomerBalanceChangedEvent', { implements: () => [ShopEvent] })
export class CustomerBalanceChangedEvent extends ShopEvent {
  @Field(() => ID)
  customerId!: string;

  @Field(() => MoneyScalar)
  balance!: string;

  @Field(() => Int)
  version!: number;
}

@ArgsType()
export class CustomerLedgerArgs extends PageArgs {
  @Field(() => ID)
  customerId!: string;

  @Field(() => Boolean, { nullable: true, description: 'Older than 90 days too (F-35).' })
  includeArchived?: boolean | null;
}

@InputType()
export class CreateCustomerInput extends PartyContactInput {}

@InputType()
export class UpdateCustomerInput extends PartyContactInput {
  @Field(() => ID)
  id!: string;

  @Field(() => Int)
  version!: number;
}

@InputType()
export class AddCustomerCreditInput extends KhataEntryInput {
  @Field(() => ID)
  customerId!: string;

  @Field(() => String, { nullable: true })
  note?: string | null;
}

@InputType()
export class ReceiveCustomerPaymentInput extends AddCustomerCreditInput {
  @Field(() => PaymentMethodEnum, { description: 'Any method except UDHAAR.' })
  method!: PaymentMethod;
}
