import { z } from 'zod';

import {
  AI_CHAT_ROLES,
  AI_CUSTOM_REPORT_MAX_DAYS,
  AI_HISTORY_MAX_CHARS,
  AI_HISTORY_MAX_TURNS,
  AI_INSIGHT_DAYS,
  AI_LANGUAGES,
  AI_MAX_ROWS,
  AI_QUESTION_MAX_CHARS,
  AI_REPORT_PERIODS,
  RANKING_MAX_DAYS,
  SEARCH_MAX_CHARS,
} from '@pos/contracts';
import { addDays } from '@pos/domain';

import { businessDateSchema, requiredText } from './common.js';

/** AI Assistant inputs (F-29, API.md §6.2) and the chat tools' arguments (SYSTEM_DESIGN.md §8). */

export const aiLanguageSchema = z.enum(AI_LANGUAGES);

/** Features whose only input is the answer language (forecast, purchases, discount advice). */
export const aiLanguageInputSchema = z.object({ language: aiLanguageSchema });
export type AiLanguageInput = z.output<typeof aiLanguageInputSchema>;

export const aiSalesInsightsInputSchema = z.object({
  periodDays: z.int().refine((days) => (AI_INSIGHT_DAYS as readonly number[]).includes(days), {
    error: 'Choose 7, 14, 30, 60 or 90 days',
  }),
  language: aiLanguageSchema,
});
export type AiSalesInsightsInput = z.output<typeof aiSalesInsightsInputSchema>;

/** True when `from` ≤ `to` and the range spans at most `maxDays` days, both ends included. */
const withinDays = (from: string, to: string, maxDays: number): boolean =>
  from <= to && to <= addDays(from, maxDays - 1);

const RANGE_ERROR = `Choose a range of at most ${String(AI_CUSTOM_REPORT_MAX_DAYS)} days, oldest first`;

const optionalDate = businessDateSchema.nullish().transform((value) => value ?? null);

/** `CUSTOM` needs both dates; the other periods end today and ignore them. */
export const aiBusinessReportInputSchema = z
  .object({
    period: z.enum(AI_REPORT_PERIODS),
    from: optionalDate,
    to: optionalDate,
    language: aiLanguageSchema,
  })
  .refine(
    (input) =>
      input.period !== 'CUSTOM' ||
      (input.from !== null &&
        input.to !== null &&
        withinDays(input.from, input.to, AI_CUSTOM_REPORT_MAX_DAYS)),
    { error: RANGE_ERROR, path: ['to'] },
  )
  .transform((input) => (input.period === 'CUSTOM' ? input : { ...input, from: null, to: null }));
export type AiBusinessReportInput = z.output<typeof aiBusinessReportInputSchema>;

const chatTurnSchema = z.object({
  role: z.enum(AI_CHAT_ROLES),
  text: z.string().trim().min(1).max(AI_HISTORY_MAX_CHARS),
});

/** "Ask Your POS": the history comes from the client and is never stored (≤ 10 turns, ≤ 4,000 chars). */
export const aiAskInputSchema = z.object({
  question: requiredText(AI_QUESTION_MAX_CHARS, 'Question'),
  history: z
    .array(chatTurnSchema)
    .max(AI_HISTORY_MAX_TURNS, { error: 'The conversation is too long; clear it to continue' })
    .nullish()
    .transform((turns) => turns ?? [])
    .refine(
      (turns) => turns.reduce((total, turn) => total + turn.text.length, 0) <= AI_HISTORY_MAX_CHARS,
      { error: 'The conversation is too long; clear it to continue' },
    ),
  language: aiLanguageSchema,
});
export type AiAskInput = z.output<typeof aiAskInputSchema>;

const toolDays = z.int().min(1).max(RANKING_MAX_DAYS).default(30);

/** Arguments the model may pass to each read-only chat tool; anything else is refused. */
export const aiToolArgsSchemas = {
  get_sales_summary: z
    .object({ from: businessDateSchema, to: businessDateSchema })
    .refine((range) => withinDays(range.from, range.to, AI_CUSTOM_REPORT_MAX_DAYS), {
      error: RANGE_ERROR,
    }),
  get_top_products: z.object({ days: toolDays, limit: z.int().min(1).max(20).default(10) }),
  get_slow_movers: z.object({ days: toolDays, limit: z.int().min(1).max(20).default(10) }),
  get_low_stock: z.object({ limit: z.int().min(1).max(AI_MAX_ROWS).default(20) }),
  get_product_sales: z.object({
    product: requiredText(SEARCH_MAX_CHARS, 'Product', 2),
    days: toolDays,
  }),
} as const;
export type AiToolName = keyof typeof aiToolArgsSchemas;
