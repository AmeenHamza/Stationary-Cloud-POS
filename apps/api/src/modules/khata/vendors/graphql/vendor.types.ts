import { ArgsType, Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';

import { PaymentMethodEnum, VendorEntryTypeEnum } from '../../../../common/graphql/enums.registry';
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

import type { PaymentMethod, VendorEntryType } from '@pos/contracts';

/** A supplier with a khata of what the shop owes (F-26). */
@ObjectType('Vendor')
export class Vendor extends PartyFields {
  @Field(() => String, { nullable: true })
  productsSupplied!: string | null;
}

@ObjectType('VendorConnection')
export class VendorConnection extends Connection(Vendor) {}

@ObjectType('VendorLedgerEntry')
export class VendorLedgerEntry extends LedgerEntryFields {
  @Field(() => VendorEntryTypeEnum)
  type!: VendorEntryType;
}

@ObjectType('VendorLedgerEntryConnection')
export class VendorLedgerEntryConnection extends Connection(VendorLedgerEntry) {}

/** `vendor.balanceChanged` (API.md §7.2). */
@ObjectType('VendorBalanceChangedEvent', { implements: () => [ShopEvent] })
export class VendorBalanceChangedEvent extends ShopEvent {
  @Field(() => ID)
  vendorId!: string;

  @Field(() => MoneyScalar)
  balance!: string;

  @Field(() => Int)
  version!: number;
}

@ArgsType()
export class VendorLedgerArgs extends PageArgs {
  @Field(() => ID)
  vendorId!: string;

  @Field(() => Boolean, { nullable: true, description: 'Older than 90 days too (F-35).' })
  includeArchived?: boolean | null;
}

@InputType()
export class CreateVendorInput extends PartyContactInput {
  @Field(() => String, { nullable: true })
  productsSupplied?: string | null;
}

@InputType()
export class UpdateVendorInput extends CreateVendorInput {
  @Field(() => ID)
  id!: string;

  @Field(() => Int)
  version!: number;
}

@InputType()
export class AddVendorPurchaseInput extends KhataEntryInput {
  @Field(() => ID)
  vendorId!: string;

  @Field(() => String, { nullable: true, description: 'What was bought (D-20: not itemised).' })
  description?: string | null;
}

@InputType()
export class PayVendorInput extends KhataEntryInput {
  @Field(() => ID)
  vendorId!: string;

  @Field(() => PaymentMethodEnum, { description: 'Any method except UDHAAR.' })
  method!: PaymentMethod;

  @Field(() => String, { nullable: true })
  note?: string | null;
}
