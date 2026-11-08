'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { useCart } from '../state/CartProvider';

import type { DiscountType } from '@pos/contracts';

export const DISCOUNT_TYPES: readonly { value: DiscountType; label: string }[] = [
  { value: 'NONE', label: 'No Discount' },
  { value: 'FLAT', label: 'Flat (Rs)' },
  { value: 'PERCENT', label: 'Percentage (%)' },
];

/** Bill discount (F-20, BR-06): none, flat rupees (≤ subtotal) or a percentage, before tax (D-08). */
export function DiscountField() {
  const { cart, dispatch } = useCart();
  const { discount } = cart;
  const field = discount.type === 'FLAT' ? 'amount' : 'percent';
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm font-medium">Discount</legend>
      <div className="flex flex-wrap gap-2">
        {DISCOUNT_TYPES.map((type) => (
          <Button
            key={type.value}
            type="button"
            size="sm"
            variant={discount.type === type.value ? 'default' : 'outline'}
            aria-pressed={discount.type === type.value}
            onClick={() => {
              dispatch({ type: 'setDiscount', discount: { ...discount, type: type.value } });
            }}
          >
            {type.label}
          </Button>
        ))}
      </div>
      {discount.type !== 'NONE' && (
        <Input
          inputMode="decimal"
          aria-label={discount.type === 'FLAT' ? 'Discount amount (Rs)' : 'Discount percentage'}
          placeholder={discount.type === 'FLAT' ? 'e.g. 50' : 'e.g. 10'}
          value={discount[field]}
          onChange={(event) => {
            dispatch({
              type: 'setDiscount',
              discount: { ...discount, [field]: event.target.value.trim() },
            });
          }}
        />
      )}
    </fieldset>
  );
}
