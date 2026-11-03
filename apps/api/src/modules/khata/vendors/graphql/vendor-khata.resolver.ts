import { Args, ID, Mutation, Resolver } from '@nestjs/graphql';

import * as schemas from '@pos/validation';

import { RequirePermission } from '../../../../common/auth/access-policy';
import { CurrentViewer } from '../../../../common/auth/current-viewer.decorator';
import { ZodValidationPipe } from '../../../../common/validation/zod-validation.pipe';
import { VendorsService } from '../application/vendors.service';

import * as types from './vendor.types';

import type { Principal } from '../../../../common/auth/principal';

/** Supplier khata entries (F-26, D-20) and archiving (D-12, Q33). */
@Resolver(() => types.Vendor)
export class VendorKhataResolver {
  constructor(private readonly service: VendorsService) {}

  @Mutation(() => types.Vendor, {
    description: '"Add Purchase (Maal Khareeda)" [K]; no stock change.',
  })
  @RequirePermission('vendors:write')
  addVendorPurchase(
    @Args(
      'input',
      { type: () => types.AddVendorPurchaseInput },
      new ZodValidationPipe(schemas.addVendorPurchaseInputSchema),
    )
    input: schemas.AddVendorPurchaseInput,
    @CurrentViewer() viewer: Principal,
  ): Promise<types.Vendor> {
    return this.service.addPurchase(input, viewer);
  }

  @Mutation(() => types.Vendor, { description: 'PAYMENT [K]; never UDHAAR.' })
  @RequirePermission('vendors:write')
  payVendor(
    @Args(
      'input',
      { type: () => types.PayVendorInput },
      new ZodValidationPipe(schemas.payVendorInputSchema),
    )
    input: schemas.PayVendorInput,
    @CurrentViewer() viewer: Principal,
  ): Promise<types.Vendor> {
    return this.service.pay(input, viewer);
  }

  @Mutation(() => types.Vendor, { description: 'Needs a zero balance (BALANCE_NOT_ZERO).' })
  @RequirePermission('vendors:archive')
  archiveVendor(
    @Args('id', { type: () => ID }, new ZodValidationPipe(schemas.idSchema)) id: string,
    @CurrentViewer() viewer: Principal,
  ): Promise<types.Vendor> {
    return this.service.archive(id, viewer);
  }

  @Mutation(() => types.Vendor)
  @RequirePermission('vendors:archive')
  restoreVendor(
    @Args('id', { type: () => ID }, new ZodValidationPipe(schemas.idSchema)) id: string,
    @CurrentViewer() viewer: Principal,
  ): Promise<types.Vendor> {
    return this.service.restore(id, viewer);
  }
}
