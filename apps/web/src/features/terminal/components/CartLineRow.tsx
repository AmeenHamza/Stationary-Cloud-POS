'use client';

import { TriangleAlertIcon, XIcon } from 'lucide-react';

import { MAX_QUANTITY_PER_LINE } from '@pos/contracts';
import { formatRs } from '@pos/domain';

import { QuantityStepper } from '@/components/forms/QuantityStepper';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';

import { useCart } from '../state/CartProvider';

import type { PreviewLine } from '../state/cart-preview';
import type { SaleUnit } from '@pos/contracts';

/**
 * One cart line (F-19, F-33, F-34): name, Piece/Box when the product has a box price, quantity,
 * unit price, line total, and a warning above stock that still allows the sale (D-16).
 */
export function CartLineRow({ entry }: { entry: PreviewLine }) {
  const { dispatch } = useCart();
  const { line, product, unitPrice, lineGross } = entry;
  const name = product?.name ?? 'Loading…';
  const unitName = line.unit === 'BOX' ? 'Box' : 'Piece';
  return (
    <li className="grid gap-2 border-b py-3 last:border-b-0" aria-label={`${name}, ${unitName}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium">{name}</span>
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          aria-label={`Remove ${name}`}
          onClick={() => {
            dispatch({ type: 'remove', productId: line.productId, unit: line.unit });
          }}
        >
          <XIcon />
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <QuantityStepper
          label={name}
          quantity={line.quantity}
          min={1}
          max={MAX_QUANTITY_PER_LINE}
          onChange={(quantity) => {
            dispatch({ type: 'setQuantity', productId: line.productId, unit: line.unit, quantity });
          }}
        />
        {product?.boxPrice != null || line.unit === 'BOX' ? (
          <NativeSelect
            className="h-7 w-24"
            aria-label={`Unit of ${name}`}
            value={line.unit}
            onChange={(event) => {
              const to = event.target.value as SaleUnit;
              dispatch({ type: 'changeUnit', productId: line.productId, from: line.unit, to });
            }}
          >
            <option value="PIECE">Piece</option>
            <option value="BOX">Box</option>
          </NativeSelect>
        ) : null}
        <span className="text-muted-foreground">
          {unitPrice === null ? 'Not for sale' : `${formatRs(unitPrice)} / ${unitName}`}
        </span>
        <span className="font-semibold">{lineGross === null ? '—' : formatRs(lineGross)}</span>
      </div>
      {entry.aboveStock && product !== undefined && (
        <p className="flex items-center gap-1 text-xs text-warning" role="status">
          <TriangleAlertIcon className="size-3.5" aria-hidden />
          Only {product.stockPieces} pcs in stock. The sale is still allowed.
        </p>
      )}
      {unitPrice === null && product !== undefined && (
        <p className="text-xs text-destructive">
          {product.archivedAt === null
            ? 'No box price: sell by the piece.'
            : 'Archived: remove it.'}
        </p>
      )}
    </li>
  );
}
