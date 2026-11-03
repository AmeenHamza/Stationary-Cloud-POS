import { Injectable } from '@nestjs/common';

import { addDays } from '@pos/domain';

import { AppError } from '../../../common/errors/app-error';
import { ClockService } from '../../../common/time/clock.service';
import { GroqClient } from '../../../infrastructure/ai/groq.client';

import { AiFactsService } from './ai-facts.service';
import { AiRequestService, answerText, type AiResultValue } from './ai-request.service';
import { featureMessages } from './prompt-builder';

import type { Principal } from '../../../common/auth/principal';
import type { AiFeature, AiLanguage, AiReportPeriod } from '@pos/contracts';
import type { AiBusinessReportInput, AiLanguageInput, AiSalesInsightsInput } from '@pos/validation';

/** Days covered by each fixed report period, ending today (F-29: 24 h, 7 days, 30 days). */
const PERIOD_DAYS: Readonly<Record<Exclude<AiReportPeriod, 'CUSTOM'>, number>> = {
  DAILY: 1,
  WEEKLY: 7,
  MONTHLY: 30,
};

/**
 * The five single-answer AI features (F-29): one bounded data load, one Groq call, no tools.
 * "Ask Your POS" is `AiChatService`.
 */
@Injectable()
export class AiReportsService {
  constructor(
    private readonly requests: AiRequestService,
    private readonly facts: AiFactsService,
    private readonly groq: GroqClient,
    private readonly clock: ClockService,
  ) {}

  salesInsights(input: AiSalesInsightsInput, viewer: Principal): Promise<AiResultValue> {
    return this.single(
      viewer,
      'SALES_INSIGHTS',
      input.language,
      { days: input.periodDays },
      (today) => this.facts.sales(addDays(today, 1 - input.periodDays), today),
    );
  }

  inventoryForecast(input: AiLanguageInput, viewer: Principal): Promise<AiResultValue> {
    return this.single(viewer, 'INVENTORY_FORECAST', input.language, {}, (today) =>
      this.facts.forecast(today),
    );
  }

  purchaseRecommendations(input: AiLanguageInput, viewer: Principal): Promise<AiResultValue> {
    return this.single(viewer, 'PURCHASE_RECOMMENDATIONS', input.language, {}, (today) =>
      this.facts.purchases(today),
    );
  }

  discountAdvice(input: AiLanguageInput, viewer: Principal): Promise<AiResultValue> {
    return this.single(viewer, 'DISCOUNT_ADVICE', input.language, {}, (today) =>
      this.facts.discounts(today),
    );
  }

  businessReport(input: AiBusinessReportInput, viewer: Principal): Promise<AiResultValue> {
    if (input.to !== null && input.to > this.clock.businessDate()) {
      throw new AppError('BAD_USER_INPUT', 'The report cannot end after today.', {
        fieldErrors: { to: 'The report cannot end after today' },
      });
    }
    const inputs = { period: input.period, from: input.from, to: input.to };
    return this.single(viewer, 'BUSINESS_REPORT', input.language, inputs, (today) => {
      if (input.period === 'CUSTOM' && input.from !== null && input.to !== null) {
        return this.facts.report(input.from, input.to);
      }
      const days = input.period === 'CUSTOM' ? 1 : PERIOD_DAYS[input.period];
      return this.facts.report(addDays(today, 1 - days), today);
    });
  }

  private single(
    viewer: Principal,
    feature: AiFeature,
    language: AiLanguage,
    inputs: Readonly<Record<string, unknown>>,
    load: (today: string) => Promise<unknown>,
  ): Promise<AiResultValue> {
    return this.requests.run(viewer, {
      feature,
      language,
      inputs,
      generate: async ({ apiKey, today }) => {
        const facts = await load(today);
        const reply = await this.groq.chat({
          apiKey,
          messages: featureMessages(feature, language, today, facts),
        });
        return {
          text: answerText(reply.message.content),
          promptTokens: reply.promptTokens,
          completionTokens: reply.completionTokens,
          toolRounds: 0,
        };
      },
    });
  }
}
