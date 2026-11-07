import { toAmount } from './chart-scale';

export interface RankedBar {
  key: string;
  label: string;
  /** Money string; non-positive values draw no bar. */
  value: string;
  detail?: string;
}

/**
 * Part-to-whole as ranked horizontal bars, largest first, one hue (dataviz: bars on one baseline
 * compare more exactly than donut slices). The value sits at the bar tip in text ink.
 */
export function RankedBars({
  title,
  bars,
  format,
  barClassByKey,
}: {
  title: string;
  bars: readonly RankedBar[];
  format: (value: string) => string;
  barClassByKey?: Readonly<Record<string, string>>;
}) {
  const largest = Math.max(1, ...bars.map((bar) => toAmount(bar.value)));
  return (
    <ul className="grid gap-2.5" aria-label={title}>
      {bars.map((bar) => {
        const share = Math.max(0, toAmount(bar.value)) / largest;
        const barClass = barClassByKey?.[bar.key] ?? 'bg-chart-accent';
        return (
          <li
            key={bar.key}
            className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] items-center gap-3 text-sm"
          >
            <span className="truncate text-muted-foreground">{bar.label}</span>
            <span className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1">
              {share > 0 ? (
                <span className="flex min-w-0 items-center">
                  <span
                    className={`h-2.5 rounded-r-lg ${barClass}`}
                    style={{ width: `${String(share * 75)}%` }}
                    aria-hidden
                  />
                </span>
              ) : (
                <span />
              )}
              <span className="justify-self-end font-medium whitespace-nowrap tabular-nums">
                {format(bar.value)}
              </span>
              {bar.detail !== undefined && (
                <span className="col-span-2 text-right text-xs text-muted-foreground">
                  {bar.detail}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
