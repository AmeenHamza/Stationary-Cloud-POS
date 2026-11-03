'use client';

import { useId } from 'react';

import { AI_INSIGHT_DAYS } from '@pos/contracts';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';

import type { ReportChoice } from '../lib/report-input';
import type { AiReportPeriod } from '@/graphql/__generated__/graphql';

/** Sales Insights period: 7, 14, 30, 60 or 90 days (F-29). */
export function InsightDaysPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (days: number) => void;
}) {
  const id = useId();
  return (
    <div className="grid max-w-xs gap-2">
      <Label htmlFor={id}>Period</Label>
      <NativeSelect
        id={id}
        value={String(value)}
        onChange={(event) => {
          onChange(AI_INSIGHT_DAYS.find((days) => String(days) === event.target.value) ?? value);
        }}
      >
        {AI_INSIGHT_DAYS.map((days) => (
          <option key={days} value={days}>
            Last {days} days
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

const PERIODS: readonly { value: AiReportPeriod; label: string }[] = [
  { value: 'DAILY', label: 'Daily (today)' },
  { value: 'WEEKLY', label: 'Weekly (last 7 days)' },
  { value: 'MONTHLY', label: 'Monthly (last 30 days)' },
  { value: 'CUSTOM', label: 'Custom dates' },
];

/** Business report period; custom ranges take two dates, at most 92 days (API.md §6.2). */
export function ReportPeriodPicker({
  value,
  onChange,
  error,
}: {
  value: ReportChoice;
  onChange: (choice: ReportChoice) => void;
  error: string | undefined;
}) {
  const id = useId();
  return (
    <div className="grid gap-3">
      <div className="grid max-w-xs gap-2">
        <Label htmlFor={`${id}-period`}>Report</Label>
        <NativeSelect
          id={`${id}-period`}
          value={value.period}
          onChange={(event) => {
            onChange({ ...value, period: event.target.value as AiReportPeriod });
          }}
        >
          {PERIODS.map((period) => (
            <option key={period.value} value={period.value}>
              {period.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      {value.period === 'CUSTOM' && (
        <div className="flex flex-wrap gap-3">
          <div className="grid gap-2">
            <Label htmlFor={`${id}-from`}>From</Label>
            <Input
              id={`${id}-from`}
              type="date"
              value={value.from}
              onChange={(event) => {
                onChange({ ...value, from: event.target.value });
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${id}-to`}>To</Label>
            <Input
              id={`${id}-to`}
              type="date"
              value={value.to}
              aria-invalid={error !== undefined}
              onChange={(event) => {
                onChange({ ...value, to: event.target.value });
              }}
            />
          </div>
        </div>
      )}
      {error !== undefined && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
