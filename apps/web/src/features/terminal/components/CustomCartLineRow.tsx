'use client';

import { XIcon } from 'lucide-react';

import { formatRs, money } from '@pos/domain';

import { QuantityStepper } from '@/components/forms/QuantityStepper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { useCart } from '../state/CartProvider';

import type { CustomCartLine } from '../state/cart.types';

export function CustomCartLineRow({ line }: { line: CustomCartLine }) {
  const { dispatch } = useCart();
  const total = money(line.unitPrice).times(line.quantity).toString();
  return (
    <li className="grid gap-2 border-b py-3 last:border-b-0">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Input
          value={line.name}
          aria-label="Custom item name"
          onChange={(event) => {
            dispatch({ type: 'updateCustom', id: line.id, patch: { name: event.target.value } });
          }}
        />
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          aria-label={`Remove ${line.name}`}
          onClick={() => {
            dispatch({ type: 'removeCustom', id: line.id });
          }}
        >
          <XIcon />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <Input
          inputMode="numeric"
          value={line.unitPrice}
          aria-label={`Unit price of ${line.name}`}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, '').slice(0, 10);
            dispatch({
              type: 'updateCustom',
              id: line.id,
              patch: { unitPrice: digits === '' ? '0' : digits },
            });
          }}
        />
        <Input
          inputMode="decimal"
          value={line.taxRate}
          aria-label={`Tax rate of ${line.name}`}
          onChange={(event) => {
            const cleaned = event.target.value.replace(/[^\d.]/g, '').slice(0, 6);
            const normalized = cleaned.split('.').slice(0, 2).join('.');
            dispatch({
              type: 'updateCustom',
              id: line.id,
              patch: { taxRate: normalized === '' || normalized === '.' ? '0' : normalized },
            });
          }}
        />
        <div className="flex items-center justify-end font-semibold">{formatRs(total)}</div>
      </div>
      <QuantityStepper
        label={line.name}
        quantity={line.quantity}
        min={1}
        max={10000}
        onChange={(quantity) => {
          dispatch({ type: 'updateCustom', id: line.id, patch: { quantity } });
        }}
      />
    </li>
  );
}
