import {
  ArgsType,
  Field,
  GraphQLISODateTime,
  ID,
  InputType,
  Int,
  ObjectType,
} from '@nestjs/graphql';

import { PaymentMethodEnum } from '../../../../common/graphql/enums.registry';
import {
  BusinessDateScalar,
  MoneyScalar,
  type DecimalLike,
} from '../../../../common/graphql/scalars';
import { PageArgs } from '../../../../common/pagination/page.args';

import type { PaymentMethod } from '@pos/contracts';

/** Fields of `Customer` and `Vendor` (DATABASE.md §4.7). */
@ObjectType({ isAbstract: true })
export abstract class PartyFields {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  phone!: string | null;

  @Field(() => String, { nullable: true })
  email!: string | null;

  @Field(() => String, { nullable: true })
  address!: string | null;

  @Field(() => MoneyScalar, {
    description: 'Customers: + owed to the shop, − advance (Q25). Vendors: + the shop owes them.',
  })
  balance!: DecimalLike;

  @Field(() => GraphQLISODateTime, { nullable: true })
  archivedAt!: Date | null;

  @Field(() => Int)
  version!: number;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;
}

/** Fields of both ledger entry types (DATABASE.md §4.8). */
@ObjectType({ isAbstract: true })
export abstract class LedgerEntryFields {
  @Field(() => ID)
  id!: string;

  @Field(() => MoneyScalar, { description: 'Signed: + raises the balance, − lowers it.' })
  amount!: DecimalLike;

  @Field(() => MoneyScalar)
  balanceAfter!: DecimalLike;

  @Field(() => PaymentMethodEnum, { nullable: true })
  paymentMethod!: PaymentMethod | null;

  @Field(() => String, { nullable: true })
  note!: string | null;

  @Field(() => BusinessDateScalar)
  businessDate!: string;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;
}

/** `customers` / `vendors` filter (API.md §6.1). Shapes only; validation is in `@pos/validation`. */
@InputType()
export class PartyFilter {
  @Field(() => String, { nullable: true, description: 'Name, or phone digits (3 or more).' })
  search?: string | null;

  @Field(() => Boolean, { nullable: true })
  withBalanceOnly?: boolean | null;

  @Field(() => Boolean, { nullable: true })
  includeArchived?: boolean | null;
}

@ArgsType()
export class PartiesArgs extends PageArgs {
  @Field(() => PartyFilter, { nullable: true })
  filter?: PartyFilter | null;
}

/** Contact fields of create and update inputs. */
@InputType({ isAbstract: true })
export abstract class PartyContactInput {
  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  phone?: string | null;

  @Field(() => String, { nullable: true })
  email?: string | null;

  @Field(() => String, { nullable: true })
  address?: string | null;
}

/** Fields every khata entry input carries [K]. */
@InputType({ isAbstract: true })
export abstract class KhataEntryInput {
  @Field(() => ID)
  idempotencyKey!: string;

  @Field(() => MoneyScalar, { description: 'Positive; the entry type gives the sign.' })
  amount!: string;
}
