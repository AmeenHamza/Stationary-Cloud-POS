import type { ReactNode } from 'react';

/** Page title with an optional description and actions on the right. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 border-b border-border/70 pb-4 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="grid min-w-0 gap-1">
        <h1 className="text-balance text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
        {description !== undefined && (
          <p className="text-sm text-muted-foreground md:text-base">{description}</p>
        )}
      </div>
      {actions !== undefined && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
