import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import * as schemas from '@pos/validation';

import { RequirePermission } from '../../../../common/auth/access-policy';
import { CurrentViewer } from '../../../../common/auth/current-viewer.decorator';
import { ZodValidationPipe } from '../../../../common/validation/zod-validation.pipe';
import { PartiesArgs } from '../../ledger/graphql/party.types';
import { VendorsService } from '../application/vendors.service';

import * as types from './vendor.types';

import type { Principal } from '../../../../common/auth/principal';
import type { ConnectionValue } from '../../../../common/pagination/connection.factory';

/** Vendors (F-26, API.md §6): cashiers and admins read and edit them (D-11). */
@Resolver(() => types.Vendor)
export class VendorsResolver {
  constructor(private readonly service: VendorsService) {}

  @Query(() => types.VendorConnection)
  @RequirePermission('vendors:read')
  vendors(
    // The pipe returns the parsed arguments (defaults applied, search trimmed).
    @Args(new ZodValidationPipe(schemas.partiesArgsSchema)) args: PartiesArgs,
  ): Promise<ConnectionValue<types.Vendor>> {
    return this.service.list(args);
  }

  @Query(() => types.Vendor, { nullable: true })
  @RequirePermission('vendors:read')
  vendor(
    @Args('id', { type: () => ID }, new ZodValidationPipe(schemas.idSchema)) id: string,
  ): Promise<types.Vendor | null> {
    return this.service.byId(id);
  }

  @Query(() => types.VendorLedgerEntryConnection, { description: 'Newest first.' })
  @RequirePermission('vendors:read')
  vendorLedger(
    @Args(new ZodValidationPipe(schemas.vendorLedgerArgsSchema)) args: types.VendorLedgerArgs,
  ): Promise<ConnectionValue<types.VendorLedgerEntry>> {
    return this.service.ledger(args.vendorId, args);
  }

  @Mutation(() => types.Vendor)
  @RequirePermission('vendors:write')
  createVendor(
    @Args(
      'input',
      { type: () => types.CreateVendorInput },
      new ZodValidationPipe(schemas.createVendorInputSchema),
    )
    input: schemas.CreateVendorInput,
    @CurrentViewer() viewer: Principal,
  ): Promise<types.Vendor> {
    return this.service.create(input, viewer);
  }

  @Mutation(() => types.Vendor)
  @RequirePermission('vendors:write')
  updateVendor(
    @Args(
      'input',
      { type: () => types.UpdateVendorInput },
      new ZodValidationPipe(schemas.updateVendorInputSchema),
    )
    input: schemas.UpdateVendorInput,
    @CurrentViewer() viewer: Principal,
  ): Promise<types.Vendor> {
    return this.service.update(input, viewer);
  }
}
