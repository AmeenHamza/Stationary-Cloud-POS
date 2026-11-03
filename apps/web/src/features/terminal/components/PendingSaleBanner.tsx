'use client';

import { LoaderCircleIcon, TriangleAlertIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

import type { SaleFlow, SaleStatus } from '../hooks/useCreateSale';

const MESSAGES: Readonly<Record<Exclude<SaleStatus, 'idle'>, string>> = {
  sending: 'Processing sale…',
  confirming: 'Confirming sale… The network dropped; retrying with the same bill.',
  checking: 'Checking the last sale…',
  unknown: 'Sale status unknown. Check its status before selling it again.',
  notRecorded: 'The last sale was not recorded.',
};

/**
 * The state of a sale not yet confirmed (SYSTEM_DESIGN.md §3.4). "Retry sale" re-sends the same
 * key, so the server records it at most once; "Discard" forgets it and keeps the cart.
 */
export function PendingSaleBanner({ sale }: { sale: SaleFlow }) {
  if (sale.status === 'idle') {
    return null;
  }
  const busy =
    sale.status === 'sending' || sale.status === 'confirming' || sale.status === 'checking';
  return (
    <div
      role="status"
      aria-live="polite"
      data-sale-status={sale.status}
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm font-medium lg:col-span-2',
        busy
          ? 'bg-primary/10'
          : 'bg-amber-100 text-amber-950 dark:bg-amber-900/60 dark:text-amber-50',
      )}
    >
      <span className="flex items-center gap-2">
        {busy ? (
          <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
        ) : (
          <TriangleAlertIcon className="size-4" aria-hidden />
        )}
        {MESSAGES[sale.status]}
      </span>
      {!busy && (
        <span className="flex gap-2">
          {sale.status === 'unknown' && (
            <Button size="sm" variant="outline" onClick={() => void sale.check()}>
              Check status
            </Button>
          )}
          <Button size="sm" onClick={sale.retry}>
            Retry sale
          </Button>
          <Button size="sm" variant="ghost" onClick={sale.discard}>
            Discard
          </Button>
        </span>
      )}
    </div>
  );
}
