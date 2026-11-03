import Link from 'next/link';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';

import type { LucideIcon } from 'lucide-react';

type TileTone = 'sales' | 'inventory' | 'orders' | 'customers' | 'reports' | 'alerts' | 'neutral';

const TONE_CLASS: Readonly<Record<TileTone, string>> = {
  sales: 'border-emerald-500/30 bg-emerald-500/5',
  inventory: 'border-blue-500/30 bg-blue-500/5',
  orders: 'border-violet-500/30 bg-violet-500/5',
  customers: 'border-cyan-500/30 bg-cyan-500/5',
  reports: 'border-amber-500/30 bg-amber-500/5',
  alerts: 'border-destructive/40 bg-destructive/5',
  neutral: 'border-border',
};

/** Polished KPI tile with optional icon, semantic accent tone and link behavior. */
export function StatTile({
  label,
  value,
  note,
  href,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  note?: string | undefined;
  href?: string;
  icon?: LucideIcon;
  tone?: TileTone;
}) {
  const body = (
    <Card
      className={cn(
        'grid h-full gap-2 border p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm',
        TONE_CLASS[tone],
      )}
      data-tile={label}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        {Icon !== undefined && (
          <span className="rounded-md border border-background/50 bg-background/70 p-1.5">
            <Icon className="size-4 text-muted-foreground" aria-hidden />
          </span>
        )}
      </div>
      <span className="text-2xl font-semibold tracking-tight tabular-nums" data-tile-value>
        {value}
      </span>
      {note !== undefined && <span className="text-xs text-muted-foreground">{note}</span>}
    </Card>
  );
  return href === undefined ? (
    body
  ) : (
    <Link
      href={href}
      prefetch={false}
      className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {body}
    </Link>
  );
}
