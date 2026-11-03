'use client';

import { useState } from 'react';

import { cn } from '@/lib/cn';

import { axisLabel, niceMax, toAmount } from './chart-scale';
import { ChartTable } from './ChartTable';

export interface ColumnSeries {
  name: string;
  /** `accent` is the measured series; `context` the gray comparison (emphasis form). */
  tone: 'accent' | 'context';
  /** Money strings, one per label. */
  values: readonly string[];
}

export const TONE = { accent: 'bg-chart-accent', context: 'bg-chart-context' } as const;
const TICKS = [1, 0.5, 0] as const;

interface BandProps {
  label: string;
  index: number;
  series: readonly ColumnSeries[];
  top: number;
  format: (value: string) => string;
  active: number | null;
  onActive: (index: number | null) => void;
}

/** One label's columns; the whole band is the hover and focus target, with a tooltip of every series. */
function Band({ label, index, series, top, format, active, onActive }: BandProps) {
  const valueOf = (entry: ColumnSeries): string => entry.values[index] ?? '0';
  return (
    <div
      role="img"
      tabIndex={0}
      aria-label={`${label}: ${series.map((s) => `${s.name} ${format(valueOf(s))}`).join(', ')}`}
      className="relative flex h-full flex-1 items-end justify-center gap-0.5 outline-none focus-visible:bg-accent/60"
      onPointerEnter={() => {
        onActive(index);
      }}
      onPointerLeave={() => {
        onActive(null);
      }}
      onFocus={() => {
        onActive(index);
      }}
      onBlur={() => {
        onActive(null);
      }}
    >
      {series.map((entry) => (
        <div
          key={entry.name}
          className={cn(
            'w-full max-w-6 rounded-t-[4px] transition-opacity',
            TONE[entry.tone],
            active !== null && active !== index && 'opacity-60',
          )}
          style={{ height: `${String((toAmount(valueOf(entry)) / top) * 100)}%` }}
        />
      ))}
      {active === index && (
        <div className="pointer-events-none absolute bottom-full z-10 mb-1 grid min-w-32 gap-1 rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md">
          <span className="text-muted-foreground">{label}</span>
          {series.map((entry) => (
            <span key={entry.name} className="flex items-center gap-1.5">
              <span className={cn('h-0.5 w-3 rounded-full', TONE[entry.tone])} aria-hidden />
              <strong className="tabular-nums">{format(valueOf(entry))}</strong>
              <span className="text-muted-foreground">{entry.name}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Columns over one baseline (dataviz: ≤ 24 px bars, 4 px rounded tops, hairline grid, one axis).
 * The legend appears only for two series; a visually hidden table carries every number.
 */
export function ColumnChart({
  title,
  labels,
  series,
  format,
}: {
  title: string;
  labels: readonly string[];
  series: readonly ColumnSeries[];
  format: (value: string) => string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const top = niceMax(series.flatMap((entry) => entry.values.map(toAmount)));
  return (
    <figure className="grid gap-3">
      {series.length > 1 && (
        <ul className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          {series.map((entry) => (
            <li key={entry.name} className="flex items-center gap-1.5">
              <span className={cn('size-2.5 rounded-sm', TONE[entry.tone])} aria-hidden />
              {entry.name}
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <div className="flex h-48 w-12 flex-col justify-between text-right text-[11px] text-muted-foreground tabular-nums">
          {TICKS.map((tick) => (
            <span key={tick}>{axisLabel(top * tick)}</span>
          ))}
        </div>
        <div className="relative h-48 flex-1">
          {TICKS.map((tick) => (
            <div
              key={tick}
              className="absolute inset-x-0 border-t border-border"
              style={{ bottom: `${String(tick * 100)}%` }}
              aria-hidden
            />
          ))}
          <div className="absolute inset-0 flex items-end">
            {labels.map((label, index) => (
              <Band
                key={label}
                {...{ label, index, series, top, format, active }}
                onActive={setActive}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="flex gap-2 pl-14 text-[11px] text-muted-foreground" aria-hidden>
        {labels.map((label) => (
          <span key={label} className="flex-1 truncate text-center">
            {label}
          </span>
        ))}
      </div>
      <ChartTable title={title} labels={labels} series={series} format={format} />
    </figure>
  );
}
