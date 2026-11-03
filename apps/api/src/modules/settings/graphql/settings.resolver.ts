import {
  Args,
  GraphQLISODateTime,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';

import {
  updateShopSettingsInputSchema,
  type UpdateShopSettingsInput as UpdateInput,
} from '@pos/validation';

import { RequirePermission } from '../../../common/auth/access-policy';
import { CurrentViewer } from '../../../common/auth/current-viewer.decorator';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { SettingsService, type ShopProfile } from '../application/settings.service';

import { ShopSettings, UpdateShopSettingsInput } from './shop-settings.type';

import type { Principal } from '../../../common/auth/principal';

/** `shopSettings` (every role) and `updateShopSettings` (admins) — API.md §6. */
@Resolver(() => ShopSettings)
export class SettingsResolver {
  constructor(private readonly settings: SettingsService) {}

  @Query(() => ShopSettings)
  @RequirePermission('settings:read')
  shopSettings(): Promise<ShopProfile> {
    return this.settings.profile();
  }

  @Mutation(() => ShopSettings)
  @RequirePermission('settings:write')
  updateShopSettings(
    @Args(
      'input',
      { type: () => UpdateShopSettingsInput },
      new ZodValidationPipe(updateShopSettingsInputSchema),
    )
    input: UpdateInput,
    @CurrentViewer() viewer: Principal,
  ): Promise<ShopProfile> {
    return this.settings.update(input, viewer);
  }

  /** The profile is cached as text; the DateTime scalar serialises only Dates. */
  @ResolveField(() => GraphQLISODateTime)
  updatedAt(@Parent() profile: ShopProfile): Date {
    return new Date(profile.updatedAt);
  }
}
