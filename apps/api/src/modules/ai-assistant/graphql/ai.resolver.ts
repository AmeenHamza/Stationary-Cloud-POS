import { Args, Mutation, Resolver } from '@nestjs/graphql';

import {
  aiAskInputSchema,
  aiBusinessReportInputSchema,
  aiLanguageInputSchema,
  aiSalesInsightsInputSchema,
  type AiAskInput as AskInput,
  type AiBusinessReportInput as ReportInput,
  type AiLanguageInput as LanguageInput,
  type AiSalesInsightsInput as InsightsInput,
} from '@pos/validation';

import { RequirePermission } from '../../../common/auth/access-policy';
import { CurrentViewer } from '../../../common/auth/current-viewer.decorator';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { AiChatService } from '../application/ai-chat.service';
import { AiReportsService } from '../application/ai-reports.service';

import {
  AiAskInput,
  AiBusinessReportInput,
  AiLanguageInput,
  AiResult,
  AiSalesInsightsInput,
} from './ai.types';

import type { Principal } from '../../../common/auth/principal';
import type { AiResultValue } from '../application/ai-request.service';

const languageInput = () =>
  Args('input', { type: () => AiLanguageInput }, new ZodValidationPipe(aiLanguageInputSchema));

/**
 * The six AI Assistant mutations (F-29, API.md §6.2), admins only. Mutations on purpose: reconnect
 * recovery refetches queries and must never repeat a paid AI call (ADR-026).
 */
@Resolver(() => AiResult)
export class AiResolver {
  constructor(
    private readonly reports: AiReportsService,
    private readonly chat: AiChatService,
  ) {}

  @Mutation(() => AiResult)
  @RequirePermission('ai:use')
  aiSalesInsights(
    @Args(
      'input',
      { type: () => AiSalesInsightsInput },
      new ZodValidationPipe(aiSalesInsightsInputSchema),
    )
    input: InsightsInput,
    @CurrentViewer() viewer: Principal,
  ): Promise<AiResultValue> {
    return this.reports.salesInsights(input, viewer);
  }

  @Mutation(() => AiResult)
  @RequirePermission('ai:use')
  aiInventoryForecast(
    @languageInput() input: LanguageInput,
    @CurrentViewer() viewer: Principal,
  ): Promise<AiResultValue> {
    return this.reports.inventoryForecast(input, viewer);
  }

  @Mutation(() => AiResult)
  @RequirePermission('ai:use')
  aiPurchaseRecommendations(
    @languageInput() input: LanguageInput,
    @CurrentViewer() viewer: Principal,
  ): Promise<AiResultValue> {
    return this.reports.purchaseRecommendations(input, viewer);
  }

  @Mutation(() => AiResult)
  @RequirePermission('ai:use')
  aiAsk(
    @Args('input', { type: () => AiAskInput }, new ZodValidationPipe(aiAskInputSchema))
    input: AskInput,
    @CurrentViewer() viewer: Principal,
  ): Promise<AiResultValue> {
    return this.chat.ask(input, viewer);
  }

  @Mutation(() => AiResult)
  @RequirePermission('ai:use')
  aiBusinessReport(
    @Args(
      'input',
      { type: () => AiBusinessReportInput },
      new ZodValidationPipe(aiBusinessReportInputSchema),
    )
    input: ReportInput,
    @CurrentViewer() viewer: Principal,
  ): Promise<AiResultValue> {
    return this.reports.businessReport(input, viewer);
  }

  @Mutation(() => AiResult)
  @RequirePermission('ai:use')
  aiDiscountAdvice(
    @languageInput() input: LanguageInput,
    @CurrentViewer() viewer: Principal,
  ): Promise<AiResultValue> {
    return this.reports.discountAdvice(input, viewer);
  }
}
