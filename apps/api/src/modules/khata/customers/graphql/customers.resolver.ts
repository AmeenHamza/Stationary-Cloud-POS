import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import * as schemas from '@pos/validation';

import { RequirePermission } from '../../../../common/auth/access-policy';
import { CurrentViewer } from '../../../../common/auth/current-viewer.decorator';
import { ZodValidationPipe } from '../../../../common/validation/zod-validation.pipe';
import { PartiesArgs } from '../../ledger/graphql/party.types';
import { CustomersService } from '../application/customers.service';

import * as types from './customer.types';

import type { Principal } from '../../../../common/auth/principal';
import type { ConnectionValue } from '../../../../common/pagination/connection.factory';

/** Customers (F-25, API.md §6): cashiers and admins read and edit them (D-11). */
@Resolver(() => types.Customer)
export class CustomersResolver {
  constructor(private readonly service: CustomersService) {}

  @Query(() => types.CustomerConnection)
  @RequirePermission('customers:read')
  customers(
    // The pipe returns the parsed arguments (defaults applied, search trimmed).
    @Args(new ZodValidationPipe(schemas.partiesArgsSchema)) args: PartiesArgs,
  ): Promise<ConnectionValue<types.Customer>> {
    return this.service.list(args);
  }

  @Query(() => types.Customer, { nullable: true })
  @RequirePermission('customers:read')
  customer(
    @Args('id', { type: () => ID }, new ZodValidationPipe(schemas.idSchema)) id: string,
  ): Promise<types.Customer | null> {
    return this.service.byId(id);
  }

  @Query(() => types.CustomerLedgerEntryConnection, { description: 'Newest first.' })
  @RequirePermission('customers:read')
  customerLedger(
    @Args(new ZodValidationPipe(schemas.customerLedgerArgsSchema)) args: types.CustomerLedgerArgs,
  ): Promise<ConnectionValue<types.CustomerLedgerEntry>> {
    return this.service.ledger(args.customerId, args);
  }

  @Mutation(() => types.Customer)
  @RequirePermission('customers:write')
  createCustomer(
    @Args(
      'input',
      { type: () => types.CreateCustomerInput },
      new ZodValidationPipe(schemas.createCustomerInputSchema),
    )
    input: schemas.CreateCustomerInput,
    @CurrentViewer() viewer: Principal,
  ): Promise<types.Customer> {
    return this.service.create(input, viewer);
  }

  @Mutation(() => types.Customer)
  @RequirePermission('customers:write')
  updateCustomer(
    @Args(
      'input',
      { type: () => types.UpdateCustomerInput },
      new ZodValidationPipe(schemas.updateCustomerInputSchema),
    )
    input: schemas.UpdateCustomerInput,
    @CurrentViewer() viewer: Principal,
  ): Promise<types.Customer> {
    return this.service.update(input, viewer);
  }
}
