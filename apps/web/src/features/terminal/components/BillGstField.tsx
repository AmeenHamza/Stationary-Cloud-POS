'use client';

import { Input } from '@/components/ui/input';

import { useCart } from '../state/CartProvider';

/** Optional Bill GST with an editable rate, defaulting to the shop's rate (F-21, D-25, Q26). */
export function BillGstField({ rate }: { rate: string }) {
  const { cart, dispatch } = useCart();
  const { applied } = cart.billGst;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={applied}
          onChange={(event) => {
            dispatch({
              type: 'setBillGst',
              billGst: { applied: event.target.checked, rate: cart.billGst.rate },
            });
          }}
        />
        Bill GST
      </label>
      {applied && (
        <label className="flex items-center gap-2 text-sm">
          Rate
          <Input
            className="w-20"
            inputMode="decimal"
            aria-label="Bill GST rate (%)"
            value={rate}
            onChange={(event) => {
              dispatch({
                type: 'setBillGst',
                billGst: { applied, rate: event.target.value.trim() },
              });
            }}
          />
          %
        </label>
      )}
    </div>
  );
}
