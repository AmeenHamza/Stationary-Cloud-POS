import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';

import { PercentScalar } from '../../../common/graphql/scalars';
import { ShopEvent } from '../../../common/graphql/shop-event.interface';

/** Shop profile used on receipts and the default Bill GST rate (Q26). */
@ObjectType('ShopSettings')
export class ShopSettings {
  @Field(() => String)
  shopName!: string;

  @Field(() => String, { nullable: true })
  address!: string | null;

  @Field(() => String, { nullable: true })
  phone!: string | null;

  @Field(() => String, { nullable: true })
  receiptFooter!: string | null;

  @Field(() => String, { nullable: true })
  exchangeReturnPolicy!: string | null;

  @Field(() => String, { nullable: true })
  logoDataUrl!: string | null;

  @Field(() => PercentScalar)
  defaultBillGstRate!: string;

  @Field(() => Int)
  version!: number;

  /** Resolved by `SettingsResolver.updatedAt` (the cached profile holds it as text). */
  updatedAt!: string;
}

/** Shape only; validation is `updateShopSettingsInputSchema` (@pos/validation). */
@InputType()
export class UpdateShopSettingsInput {
  @Field(() => String)
  shopName!: string;

  @Field(() => String, { nullable: true })
  address?: string | null;

  @Field(() => String, { nullable: true })
  phone?: string | null;

  @Field(() => String, { nullable: true })
  receiptFooter?: string | null;

  @Field(() => String, { nullable: true })
  exchangeReturnPolicy?: string | null;

  @Field(() => String, { nullable: true })
  logoDataUrl?: string | null;

  @Field(() => PercentScalar)
  defaultBillGstRate!: string;

  @Field(() => Int)
  version!: number;
}

/** `settings.changed` (API.md §7.2): clients refetch `shopSettings` (≈ 300 bytes). */
@ObjectType('SettingsChangedEvent', { implements: () => [ShopEvent] })
export class SettingsChangedEvent extends ShopEvent {
  @Field(() => Int)
  version!: number;
}

/** Shape only; validation is `setAiApiKeyInputSchema` (@pos/validation). Never returned (F-30). */
@InputType()
export class SetAiApiKeyInput {
  @Field(() => String)
  apiKey!: string;
}
