'use client';

import { useApolloClient } from '@apollo/client/react';

import {
  AiBusinessReportDocument,
  AiDiscountAdviceDocument,
  AiInventoryForecastDocument,
  AiPurchaseRecommendationsDocument,
  AiSalesInsightsDocument,
} from '../graphql/ai.documents';

import { useAiRequest } from './useAiRequest';

import type {
  AiBusinessReportInput,
  AiLanguage,
  AiResultFieldsFragment,
} from '@/graphql/__generated__/graphql';
import type { AiFeature } from '@pos/contracts';

export interface AiFeatureOptions {
  language: AiLanguage;
  periodDays: number;
  /** Present for the business report only. */
  report: AiBusinessReportInput | undefined;
}

type SingleFeature = Exclude<AiFeature, 'ASK'>;

/**
 * Runs one of the five single-answer features. Results are not kept in the Apollo cache
 * (`no-cache`): an answer is shown once, and the server already caches it for 15 minutes.
 */
export function useAiFeature(feature: SingleFeature) {
  const client = useApolloClient();
  const request = useAiRequest();

  const generate = (options: AiFeatureOptions) =>
    request.run(async (): Promise<AiResultFieldsFragment | undefined> => {
      const language = { input: { language: options.language } };
      const fetchPolicy = 'no-cache' as const;
      switch (feature) {
        case 'SALES_INSIGHTS': {
          const input = { periodDays: options.periodDays, language: options.language };
          const { data } = await client.mutate({
            mutation: AiSalesInsightsDocument,
            variables: { input },
            fetchPolicy,
          });
          return data?.result;
        }
        case 'INVENTORY_FORECAST':
          return (
            await client.mutate({
              mutation: AiInventoryForecastDocument,
              variables: language,
              fetchPolicy,
            })
          ).data?.result;
        case 'PURCHASE_RECOMMENDATIONS':
          return (
            await client.mutate({
              mutation: AiPurchaseRecommendationsDocument,
              variables: language,
              fetchPolicy,
            })
          ).data?.result;
        case 'BUSINESS_REPORT':
          if (options.report === undefined) {
            return undefined;
          }
          return (
            await client.mutate({
              mutation: AiBusinessReportDocument,
              variables: { input: options.report },
              fetchPolicy,
            })
          ).data?.result;
        case 'DISCOUNT_ADVICE':
          return (
            await client.mutate({
              mutation: AiDiscountAdviceDocument,
              variables: language,
              fetchPolicy,
            })
          ).data?.result;
      }
    });

  return { ...request, generate };
}
