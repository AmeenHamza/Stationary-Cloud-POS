import { DEFAULT_BUSINESS_TIMEZONE } from '@pos/contracts';
import { formatDateTime } from '@pos/domain';

import { Badge } from '@/components/ui/badge';

import { AiMarkdown } from './AiMarkdown';

import type { AiResultFieldsFragment } from '@/graphql/__generated__/graphql';

/** Urdu answers read right to left; English and Roman Urdu left to right. */
export function directionOf(language: AiResultFieldsFragment['language']): 'rtl' | 'ltr' {
  return language === 'URDU' ? 'rtl' : 'ltr';
}

/** One AI answer with when it was generated; cached answers say so (ADR-026, 15 minutes). */
export function AiResultView({ result }: { result: AiResultFieldsFragment }) {
  const direction = directionOf(result.language);
  return (
    <article className="grid gap-2" aria-label="AI answer">
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        Generated {formatDateTime(new Date(result.generatedAt), DEFAULT_BUSINESS_TIMEZONE)}
        {result.cached && <Badge variant="muted">Saved answer from the last 15 minutes</Badge>}
      </p>
      <div dir={direction} lang={result.language === 'URDU' ? 'ur' : 'en'} className="text-[15px]">
        <AiMarkdown text={result.text} />
      </div>
    </article>
  );
}
