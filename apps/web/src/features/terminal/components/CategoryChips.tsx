'use client';

import { Button } from '@/components/ui/button';
import { useCategoryOptions } from '@/features/catalog';

/** "All Products" plus one chip per category (F-18); `''` means all. */
export function CategoryChips({
  value,
  onChange,
}: {
  value: string;
  onChange: (categoryId: string) => void;
}) {
  const categories = useCategoryOptions();
  const chips = [{ value: '', label: 'All Products' }, ...categories];
  return (
    <div
      className="scrollbar-subtle max-h-28 overflow-y-auto pr-1"
      role="group"
      aria-label="Categories"
    >
      <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
          <Button
            key={chip.value}
            size="sm"
            variant={chip.value === value ? 'default' : 'outline'}
            aria-pressed={chip.value === value}
            onClick={() => {
              onChange(chip.value);
            }}
          >
            {chip.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
