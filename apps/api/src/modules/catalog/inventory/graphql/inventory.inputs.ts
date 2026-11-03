import { Field, ID, InputType, Int } from '@nestjs/graphql';

import {
  AdjustmentDirectionEnum,
  AdjustmentReasonEnum,
} from '../../../../common/graphql/enums.registry';

import type { AdjustmentDirection, AdjustmentReason } from '@pos/contracts';

/** Shapes only; validation is in `@pos/validation` (inventory.schemas.ts). */
@InputType()
export class RestockInput {
  @Field(() => ID)
  idempotencyKey!: string;

  @Field(() => ID)
  productId!: string;

  @Field(() => Int)
  boxes!: number;

  @Field(() => Int)
  pieces!: number;

  @Field(() => String, { nullable: true })
  note?: string | null;
}

@InputType()
export class AdjustStockInput {
  @Field(() => ID)
  idempotencyKey!: string;

  @Field(() => ID)
  productId!: string;

  @Field(() => AdjustmentDirectionEnum)
  direction!: AdjustmentDirection;

  @Field(() => Int)
  quantityPieces!: number;

  @Field(() => AdjustmentReasonEnum)
  reason!: AdjustmentReason;

  @Field(() => String, { nullable: true })
  note?: string | null;
}
