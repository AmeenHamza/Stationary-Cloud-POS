import { balanceState, formatRs } from '@pos/domain';

import { cn } from '@/lib/cn';

import type { BalanceLabels } from './khata-labels';

/** "Rs 2,450.00 owed" / "Rs 75.00 advance" / "Settled" (Q25), coloured by state. */
export function BalanceText({
  balance,
  labels,
  className,
}: {
  balance: string;
  labels: BalanceLabels;
  className?: string;
}) {
  const { state, magnitude } = balanceState(balance);
  return (
    <span
      data-balance-state={state}
      className={cn(
        'tabular-nums',
        state === 'owed' && 'font-semibold text-destructive',
        state === 'advance' && 'font-semibold text-success',
        state === 'settled' && 'text-muted-foreground',
        className,
      )}
    >
      {state === 'settled' ? labels.settled : `${formatRs(magnitude)} ${labels[state]}`}
    </span>
  );
}
