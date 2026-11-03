import { Args, ID, Mutation, Resolver } from '@nestjs/graphql';

import * as schemas from '@pos/validation';

import { RequirePermission } from '../../../../common/auth/access-policy';
import { CurrentViewer } from '../../../../common/auth/current-viewer.decorator';
import { ZodValidationPipe } from '../../../../common/validation/zod-validation.pipe';
import { CustomersService } from '../application/customers.service';

import * as types from './customer.types';

import type { Principal } from '../../../../common/auth/principal';

/**
 * Khata entries (F-25) and archiving (D-12, Q33). Each entry mutation returns the customer with its
 * new balance; the ledger page is re-read by the screen.
 */
@Resolver(() => types.Customer)
export class CustomerKhataResolver {
  constructor(private readonly service: CustomersService) {}

  @Mutation(() => types.Customer, { description: '"Add Udhaar": MANUAL_CREDIT [K].' })
  @RequirePermission('customers:write')
  addCustomerCredit(
    @Args(
      'input',
      { type: () => types.AddCustomerCreditInput },
      new ZodValidationPipe(schemas.addCustomerCreditInputSchema),
    )
    input: schemas.AddCustomerCreditInput,
    @CurrentViewer() viewer: Principal,
  ): Promise<types.Customer> {
    return this.service.addCredit(input, viewer);
  }

  @Mutation(() => types.Customer, { description: 'PAYMENT [K]; never UDHAAR.' })
  @RequirePermission('customers:write')
  receiveCustomerPayment(
    @Args(
      'input',
      { type: () => types.ReceiveCustomerPaymentInput },
      new ZodValidationPipe(schemas.receiveCustomerPaymentInputSchema),
    )
    input: schemas.ReceiveCustomerPaymentInput,
    @CurrentViewer() viewer: Principal,
  ): Promise<types.Customer> {
    return this.service.receivePayment(input, viewer);
  }

  @Mutation(() => types.Customer, { description: 'Needs a zero balance (BALANCE_NOT_ZERO).' })
  @RequirePermission('customers:archive')
  archiveCustomer(
    @Args('id', { type: () => ID }, new ZodValidationPipe(schemas.idSchema)) id: string,
    @CurrentViewer() viewer: Principal,
  ): Promise<types.Customer> {
    return this.service.archive(id, viewer);
  }

  @Mutation(() => types.Customer)
  @RequirePermission('customers:archive')
  restoreCustomer(
    @Args('id', { type: () => ID }, new ZodValidationPipe(schemas.idSchema)) id: string,
    @CurrentViewer() viewer: Principal,
  ): Promise<types.Customer> {
    return this.service.restore(id, viewer);
  }
}
