import { Args, Mutation, ResolveField, Resolver } from '@nestjs/graphql';

import { setAiApiKeyInputSchema, type SetAiApiKeyInput as SetKeyInput } from '@pos/validation';

import { RequirePermission } from '../../../common/auth/access-policy';
import { CurrentViewer } from '../../../common/auth/current-viewer.decorator';
import { requireFieldPermission } from '../../../common/auth/field-permission';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { AiKeyService } from '../application/ai-key.service';
import { SettingsService, type ShopProfile } from '../application/settings.service';

import { SetAiApiKeyInput, ShopSettings } from './shop-settings.type';

import type { Principal } from '../../../common/auth/principal';

/**
 * The Groq key (F-30, API.md §6): admins set or clear it and see only whether it is configured and
 * its last 4 characters (SEC-03 for anyone else). The key itself is never a field.
 */
@Resolver(() => ShopSettings)
export class AiKeyResolver {
  constructor(
    private readonly keys: AiKeyService,
    private readonly settings: SettingsService,
  ) {}

  @ResolveField(() => Boolean, { middleware: [requireFieldPermission('settings:write')] })
  async aiKeyConfigured(): Promise<boolean> {
    return (await this.keys.status()).configured;
  }

  @ResolveField(() => String, {
    nullable: true,
    middleware: [requireFieldPermission('settings:write')],
  })
  async aiKeyLast4(): Promise<string | null> {
    return (await this.keys.status()).last4;
  }

  @Mutation(() => ShopSettings)
  @RequirePermission('settings:write')
  async setAiApiKey(
    @Args('input', { type: () => SetAiApiKeyInput }, new ZodValidationPipe(setAiApiKeyInputSchema))
    input: SetKeyInput,
    @CurrentViewer() viewer: Principal,
  ): Promise<ShopProfile> {
    await this.keys.set(input.apiKey, viewer);
    return this.settings.profile();
  }

  @Mutation(() => ShopSettings)
  @RequirePermission('settings:write')
  async clearAiApiKey(@CurrentViewer() viewer: Principal): Promise<ShopProfile> {
    await this.keys.clear(viewer);
    return this.settings.profile();
  }
}
