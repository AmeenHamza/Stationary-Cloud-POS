import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** A list with no rows: an icon and one sentence saying why. */
export function EmptyState({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border bg-card p-10 text-center text-muted-foreground">
      <Icon className="size-8" aria-hidden />
      {children}
    </div>
  );
}
