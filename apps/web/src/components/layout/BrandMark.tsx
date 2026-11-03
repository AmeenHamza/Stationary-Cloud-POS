import { cn } from '@/lib/cn';

/** Product name in the brand gradient, with an optional subtitle (e.g. "Admin panel"). */
export function BrandMark({
  subtitle,
  size = 'md',
  className,
}: {
  subtitle?: string;
  size?: 'md' | 'lg';
  className?: string;
}) {
  return (
    <div className={cn('grid gap-1', className)}>
      <span
        className={cn(
          'bg-linear-to-r from-brand-from to-brand-to bg-clip-text font-bold tracking-tight text-transparent',
          size === 'lg' ? 'text-4xl' : 'text-2xl',
        )}
      >
        Brandwings POS
      </span>
      {subtitle !== undefined && (
        <span className="text-xs font-semibold tracking-widest text-primary uppercase">
          {subtitle}
        </span>
      )}
    </div>
  );
}
