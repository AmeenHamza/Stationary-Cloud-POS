import { graphql } from '@/graphql/__generated__';

/** AI Assistant (F-29, API.md §6.2). Mutations: recovery never repeats a paid call (ADR-026). */
export const AiResultFieldsFragment = graphql(`
  fragment AiResultFields on AiResult {
    text
    language
    generatedAt
    cached
  }
`);

export const AiSalesInsightsDocument = graphql(`
  mutation AiSalesInsights($input: AiSalesInsightsInput!) {
    result: aiSalesInsights(input: $input) {
      ...AiResultFields
    }
  }
`);

export const AiInventoryForecastDocument = graphql(`
  mutation AiInventoryForecast($input: AiLanguageInput!) {
    result: aiInventoryForecast(input: $input) {
      ...AiResultFields
    }
  }
`);

export const AiPurchaseRecommendationsDocument = graphql(`
  mutation AiPurchaseRecommendations($input: AiLanguageInput!) {
    result: aiPurchaseRecommendations(input: $input) {
      ...AiResultFields
    }
  }
`);

export const AiBusinessReportDocument = graphql(`
  mutation AiBusinessReport($input: AiBusinessReportInput!) {
    result: aiBusinessReport(input: $input) {
      ...AiResultFields
    }
  }
`);

export const AiDiscountAdviceDocument = graphql(`
  mutation AiDiscountAdvice($input: AiLanguageInput!) {
    result: aiDiscountAdvice(input: $input) {
      ...AiResultFields
    }
  }
`);

export const AiAskDocument = graphql(`
  mutation AiAsk($input: AiAskInput!) {
    result: aiAsk(input: $input) {
      ...AiResultFields
    }
  }
`);
