'use client';

import { Loader2Icon, SparklesIcon } from 'lucide-react';
import { useState } from 'react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import { useAiFeature } from '../hooks/useAiFeature';
import { reportInput, type ReportChoice } from '../lib/report-input';

import { AiAnswerCard } from './AiAnswerCard';
import { AiBackLink, AiKeyNotice } from './AiKeyNotice';
import { LanguagePicker } from './LanguagePicker';
import { InsightDaysPicker, ReportPeriodPicker } from './PeriodPickers';

import type { AiFeatureInfo } from '../lib/ai-features';
import type { AiLanguage } from '@/graphql/__generated__/graphql';
import type { AiFeature } from '@pos/contracts';

/** One of the five single-answer AI features (F-29): choose inputs, generate, read or print. */
export function AiFeatureScreen({
  info,
}: {
  info: AiFeatureInfo & { feature: Exclude<AiFeature, 'ASK'> };
}) {
  const [language, setLanguage] = useState<AiLanguage>('ENGLISH');
  const [periodDays, setPeriodDays] = useState(30);
  const [choice, setChoice] = useState<ReportChoice>({ period: 'DAILY', from: '', to: '' });
  const [reportError, setReportError] = useState<string>();
  const ai = useAiFeature(info.feature);

  const generate = () => {
    const report = info.inputs === 'report' ? reportInput(choice, language) : undefined;
    if (report !== undefined && 'error' in report) {
      setReportError(report.error);
      return;
    }
    setReportError(undefined);
    void ai.generate({ language, periodDays, report: report?.input });
  };

  return (
    <>
      <PageHeader title={info.title} description={info.description} actions={<AiBackLink />} />
      <AiKeyNotice />
      <Card>
        <CardContent className="grid gap-5 pt-6">
          <LanguagePicker value={language} onChange={setLanguage} disabled={ai.loading} />
          {info.inputs === 'days' && (
            <InsightDaysPicker value={periodDays} onChange={setPeriodDays} />
          )}
          {info.inputs === 'report' && (
            <ReportPeriodPicker value={choice} onChange={setChoice} error={reportError} />
          )}
          {info.feature === 'DISCOUNT_ADVICE' && (
            <p className="text-sm text-muted-foreground">
              Recommendations only. No discount is applied automatically; you decide.
            </p>
          )}
          <div>
            <Button onClick={generate} disabled={ai.loading}>
              {ai.loading ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
              {ai.loading ? 'Generating…' : 'Generate'}
            </Button>
          </div>
          {ai.error !== undefined && (
            <p role="alert" className="text-sm text-destructive">
              {ai.error}
            </p>
          )}
        </CardContent>
      </Card>
      {ai.result !== undefined && (
        <AiAnswerCard
          key={ai.result.generatedAt}
          result={ai.result}
          title={info.title}
          printable={info.printable}
        />
      )}
    </>
  );
}
