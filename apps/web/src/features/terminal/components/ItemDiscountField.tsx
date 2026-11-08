'use client';

import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import { useState } from 'react';

import { formatRs, type Decimal } from '@pos/domain';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';

import { NO_DISCOUNT, type CartDiscount } from '../state/cart.types';
import { useCart } from '../state/CartProvider';

import { DISCOUNT_TYPES } from './DiscountField';

import type { CartPreview } from '../state/cart-preview';
import type { DiscountType } from '@pos/contracts';

interface ItemRow {
  key: string;
  name: string;
  gross: Decimal | null;
  /** What the preview takes off this item; null until the bill can be priced. */
  off: Decimal | null;
  discount: CartDiscount;
  set: (discount: CartDiscount) => void;
}

function ItemDiscountRow({ row }: { row: ItemRow }) {
  const { name, discount, off } = row;
  const field = discount.type === 'FLAT' ? 'amount' : 'percent';
  return (
    <li className="grid gap-2 border-b pb-2 text-sm last:border-b-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_9rem_6rem] sm:items-center">
      <span className="min-w-0">
        <span className="block truncate font-medium">{name}</span>
        <span className="text-muted-foreground tabular-nums">
          {row.gross === null ? '—' : formatRs(row.gross)}
          {off !== null && !off.isZero() && ` · -${formatRs(off)}`}
        </span>
      </span>
      <NativeSelect
        aria-label={`Discount type for ${name}`}
        value={discount.type}
        onChange={(event) => {
          row.set({ ...discount, type: event.target.value as DiscountType });
        }}
      >
        {DISCOUNT_TYPES.map((type) => (
          <option key={type.value} value={type.value}>
            {type.label}
          </option>
        ))}
      </NativeSelect>
      {discount.type === 'NONE' ? (
        <span aria-hidden />
      ) : (
        <Input
          inputMode="decimal"
          aria-label={
            discount.type === 'FLAT'
              ? `Discount amount for ${name} (Rs)`
              : `Discount percentage for ${name}`
          }
          placeholder={discount.type === 'FLAT' ? 'Rs' : '%'}
          value={discount[field]}
          onChange={(event) => {
            row.set({ ...discount, [field]: event.target.value.trim() });
          }}
        />
      )}
    </li>
  );
}

/**
 * A discount on specific items (D-27), next to the overall discount, which is then taken from what
 * is left. Folded away until needed, and open when the cart already has one.
 */
export function ItemDiscountField({ preview }: { preview: CartPreview }) {
  const { dispatch } = useCart();
  const count = preview.lines.length;
  const rows: ItemRow[] = [
    ...preview.lines.map(({ line, product, lineGross }, index) => ({
      key: `${line.productId}:${line.unit}`,
      name: `${product?.name ?? 'Item'}${line.unit === 'BOX' ? ' (Box)' : ''}`,
      gross: lineGross,
      off: preview.bill?.lines[index]?.itemDiscount ?? null,
      discount: line.discount ?? NO_DISCOUNT,
      set: (discount: CartDiscount) => {
        const { productId, unit } = line;
        dispatch({ type: 'setLineDiscount', productId, unit, discount });
      },
    })),
    ...preview.customLines.map(({ line, lineGross }, index) => ({
      key: line.id,
      name: line.name,
      gross: lineGross,
      off: preview.bill?.lines[count + index]?.itemDiscount ?? null,
      discount: line.discount ?? NO_DISCOUNT,
      set: (discount: CartDiscount) => {
        dispatch({ type: 'updateCustom', id: line.id, patch: { discount } });
      },
    })),
  ];
  const [open, setOpen] = useState(rows.some((row) => row.discount.type !== 'NONE'));
  const Chevron = open ? ChevronDownIcon : ChevronRightIcon;
  return (
    <div className="grid gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-fit px-0"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
        }}
      >
        <Chevron /> Discount on specific items
      </Button>
      {open && (
        <ul className="grid gap-2 rounded-lg border p-3">
          {rows.map((row) => (
            <ItemDiscountRow key={row.key} row={row} />
          ))}
        </ul>
      )}
    </div>
  );
}
