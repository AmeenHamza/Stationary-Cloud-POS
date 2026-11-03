import { aiBusinessReportInputSchema } from '@pos/validation';

import type {
  AiBusinessReportInput,
  AiLanguage,
  AiReportPeriod,
} from '@/graphql/__generated__/graphql';

/** The business report form: empty date fields are `''` until the user picks a date. */
export interface ReportChoice {
  period: AiReportPeriod;
  from: string;
  to: string;
}

/**
 * The `aiBusinessReport` input for the form, checked with the shared schema (API.md §6.2). Empty
 * date fields are sent as null: only `CUSTOM` needs dates, at most 92 days.
 */
export function reportInput(
  choice: ReportChoice,
  language: AiLanguage,
): { input: AiBusinessReportInput } | { error: string } {
  const parsed = aiBusinessReportInputSchema.safeParse({
    period: choice.period,
    from: choice.from === '' ? null : choice.from,
    to: choice.to === '' ? null : choice.to,
    language,
  });
  return parsed.success
    ? { input: parsed.data }
    : { error: parsed.error.issues[0]?.message ?? 'Check the report dates' };
}
