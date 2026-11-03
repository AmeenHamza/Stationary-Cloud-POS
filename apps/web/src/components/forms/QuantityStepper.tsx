'use client';

import { MinusIcon, PlusIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/**
 * − / quantity / + for whole units (cart lines, refund quantities). `min` below 1 lets the caller
 * treat zero as "none" (a cart line removes itself; a refund line is not selected).
 */
export function QuantityStepper({
  label,
  quantity,
  onChange,
  min,
  max,
}: {
  label: string;
  quantity: number;
  onChange: (quantity: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        size="icon"
        variant="outline"
        className="size-7"
        aria-label={`One less ${label}`}
        disabled={quantity <= min}
        onClick={() => {
          onChange(clamp(quantity - 1, min, max));
        }}
      >
        <MinusIcon />
      </Button>
      <Input
        className="h-7 w-14 px-1 text-center"
        inputMode="numeric"
        aria-label={`Quantity of ${label}`}
        value={String(quantity)}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, '').slice(0, 6);
          onChange(digits === '' ? min : clamp(Number.parseInt(digits, 10), min, max));
        }}
      />
      <Button
        size="icon"
        variant="outline"
        className="size-7"
        aria-label={`One more ${label}`}
        disabled={quantity >= max}
        onClick={() => {
          onChange(clamp(quantity + 1, min, max));
        }}
      >
        <PlusIcon />
      </Button>
    </div>
  );
}
