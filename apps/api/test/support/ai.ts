import { randomBytes } from 'node:crypto';

import { afterAll, beforeAll } from 'vitest';

import { startGroqStub, type GroqStub } from '@pos/testkit';

import { useRoles, type RoleHarness } from './roles';
import { asUser } from './staff';

const RESULT = 'text language generatedAt cached';

export const KEY_STATUS = '{ shopSettings { aiKeyConfigured aiKeyLast4 } }';
export const SET_KEY = `mutation SetKey($input: SetAiApiKeyInput!) {
  setAiApiKey(input: $input) { aiKeyConfigured aiKeyLast4 } }`;
export const CLEAR_KEY = 'mutation { clearAiApiKey { aiKeyConfigured aiKeyLast4 } }';

/** The six AI mutations (API.md §6.2), each with its own input type. */
export const AI = {
  SALES_INSIGHTS: `mutation A($input: AiSalesInsightsInput!) { aiSalesInsights(input: $input) { ${RESULT} } }`,
  INVENTORY_FORECAST: `mutation A($input: AiLanguageInput!) { aiInventoryForecast(input: $input) { ${RESULT} } }`,
  PURCHASE_RECOMMENDATIONS: `mutation A($input: AiLanguageInput!) {
    aiPurchaseRecommendations(input: $input) { ${RESULT} } }`,
  ASK: `mutation A($input: AiAskInput!) { aiAsk(input: $input) { ${RESULT} } }`,
  BUSINESS_REPORT: `mutation A($input: AiBusinessReportInput!) { aiBusinessReport(input: $input) { ${RESULT} } }`,
  DISCOUNT_ADVICE: `mutation A($input: AiLanguageInput!) { aiDiscountAdvice(input: $input) { ${RESULT} } }`,
} as const;
export type AiOperation = keyof typeof AI;

export interface AiResultBody {
  text: string;
  language: string;
  generatedAt: string;
  cached: boolean;
}

/** A valid input for each feature in `language`. */
export function aiInput(feature: AiOperation, language: string, extra: object = {}): object {
  switch (feature) {
    case 'SALES_INSIGHTS':
      return { periodDays: 7, language, ...extra };
    case 'BUSINESS_REPORT':
      return { period: 'WEEKLY', language, ...extra };
    case 'ASK':
      return { question: 'How were sales today?', history: [], language, ...extra };
    default:
      return { language, ...extra };
  }
}

/** A random key per run (no key-shaped literal in the repository, rule 10). */
export const newTestKey = (): string => `test-groq-key-${randomBytes(16).toString('hex')}`;

export interface AiHarness extends RoleHarness {
  stub: GroqStub;
  run: (feature: AiOperation, language: string, extra?: object) => ReturnType<typeof asUser>;
}

/** A Groq stub plus the API pointed at it (`GROQ_BASE_URL`), with an admin and a cashier. */
export function useAiHarness(): AiHarness {
  const ai = {} as { stub: GroqStub };
  beforeAll(async () => {
    ai.stub = await startGroqStub();
  });
  const harness = useRoles({ env: () => ({ GROQ_BASE_URL: ai.stub.url }) }) as AiHarness;
  afterAll(async () => {
    await ai.stub.close();
  });
  Object.defineProperty(harness, 'stub', { get: () => ai.stub });
  harness.run = (feature, language, extra = {}) =>
    asUser(harness.h.url, harness.admin, AI[feature], {
      input: aiInput(feature, language, extra),
    });
  return harness;
}
