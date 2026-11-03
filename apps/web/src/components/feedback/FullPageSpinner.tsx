import { Loader2Icon } from 'lucide-react';

/** Shown while the first query of a page (usually `me`) is in flight. */
export function FullPageSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      className="flex min-h-svh items-center justify-center gap-3 text-muted-foreground"
      role="status"
    >
      <Loader2Icon className="size-5 animate-spin" aria-hidden />
      <span>{label}</span>
    </div>
  );
}
