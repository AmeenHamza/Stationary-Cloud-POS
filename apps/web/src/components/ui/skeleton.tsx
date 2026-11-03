import { cn } from '@/lib/cn';

import type { ComponentProps } from 'react';

/** Subtle shimmer placeholder for async sections; size and shape come from className. */
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        'animate-pulse rounded-md bg-linear-to-r from-muted via-muted/70 to-muted bg-size-[240%_100%] motion-reduce:animate-none',
        className,
      )}
      {...props}
    />
  );
}
