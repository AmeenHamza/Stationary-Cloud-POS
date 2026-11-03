import { Field, GraphQLISODateTime, InputType, Int, ObjectType } from '@nestjs/graphql';

import {
  AiChatRoleEnum,
  AiLanguageEnum,
  AiReportPeriodEnum,
} from '../../../common/graphql/enums.registry';

import type { AiChatRole, AiLanguage, AiReportPeriod } from '@pos/contracts';

/** Every AI mutation's result (API.md §6.2). `text` is Markdown; the client renders it sanitised. */
@ObjectType('AiResult')
export class AiResult {
  @Field(() => String)
  text!: string;

  @Field(() => AiLanguageEnum)
  language!: AiLanguage;

  @Field(() => GraphQLISODateTime)
  generatedAt!: Date;

  @Field(() => Boolean, { description: 'Served from the 15-minute cache (ADR-026)' })
  cached!: boolean;
}

/** Shapes only; validation is in `@pos/validation` (ai.schemas.ts). */
@InputType()
export class AiLanguageInput {
  @Field(() => AiLanguageEnum)
  language!: AiLanguage;
}

@InputType()
export class AiSalesInsightsInput {
  @Field(() => Int, { description: '7, 14, 30, 60 or 90' })
  periodDays!: number;

  @Field(() => AiLanguageEnum)
  language!: AiLanguage;
}

@InputType()
export class AiBusinessReportInput {
  @Field(() => AiReportPeriodEnum)
  period!: AiReportPeriod;

  @Field(() => String, { nullable: true, description: 'CUSTOM only: first day, YYYY-MM-DD' })
  from?: string | null;

  @Field(() => String, { nullable: true, description: 'CUSTOM only: last day (≤ 92 days)' })
  to?: string | null;

  @Field(() => AiLanguageEnum)
  language!: AiLanguage;
}

@InputType()
export class AiChatTurnInput {
  @Field(() => AiChatRoleEnum)
  role!: AiChatRole;

  @Field(() => String)
  text!: string;
}

@InputType()
export class AiAskInput {
  @Field(() => String)
  question!: string;

  @Field(() => [AiChatTurnInput], { nullable: true, description: '≤ 10 turns, ≤ 4,000 characters' })
  history?: AiChatTurnInput[] | null;

  @Field(() => AiLanguageEnum)
  language!: AiLanguage;
}
