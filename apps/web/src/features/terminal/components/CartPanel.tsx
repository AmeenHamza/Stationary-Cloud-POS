'use client';

import { PlusIcon, ShoppingCartIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';

import { formatRs, sum, type Decimal } from '@pos/domain';

import { Button } from '@/components/ui/button';

import { useCartPreview } from '../hooks/useCartPreview';
import { useCart } from '../state/CartProvider';

import { CartLineRow } from './CartLineRow';
import { CustomCartLineRow } from './CustomCartLineRow';
import { PaymentDialog } from './PaymentDialog';

import type { SaleFlow } from '../hooks/useCreateSale';

/** The cart (F-19, `#42`): lines, item count, subtotal and "Proceed to Payment". */
export function CartPanel({ sale }: { sale: SaleFlow }) {
  const { dispatch } = useCart();
  const preview = useCartPreview();
  const [paying, setPaying] = useState(false);
  const grosses = [
    ...preview.lines.flatMap((entry) => (entry.lineGross === null ? [] : [entry.lineGross])),
    ...preview.customLines.map((entry) => entry.lineGross),
  ];
  const subtotal: Decimal = sum(grosses);
  return (
    <aside
      aria-label="Cart"
      className="flex flex-col rounded-xl border bg-card p-4 shadow-xs lg:sticky lg:top-4 lg:max-h-[calc(100svh-7rem)]"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ShoppingCartIcon className="size-5" aria-hidden /> Cart
        </h2>
        {(preview.lines.length > 0 || preview.customLines.length > 0) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              dispatch({ type: 'clear' });
            }}
          >
            <Trash2Icon /> Clear
          </Button>
        )}
      </div>
      <div className="mt-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            dispatch({
              type: 'addCustom',
              line: {
                id: crypto.randomUUID(),
                name: 'Custom item',
                unit: 'PIECE',
                quantity: 1,
                unitPrice: '0.00',
                taxRate: '0',
              },
            });
          }}
        >
          <PlusIcon /> Add custom item
        </Button>
      </div>
      {preview.lines.length === 0 && preview.customLines.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">
          Tap a product or add a custom item
        </p>
      ) : (
        <ul className="-mx-1 flex-1 overflow-y-auto px-1">
          {preview.lines.map((entry) => (
            <CartLineRow key={`${entry.line.productId}:${entry.line.unit}`} entry={entry} />
          ))}
          {preview.customLines.map((entry) => (
            <CustomCartLineRow key={entry.line.id} line={entry.line} />
          ))}
        </ul>
      )}
      <div className="mt-3 grid gap-3 border-t pt-3">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Items</span>
          <span data-testid="cart-item-count">{preview.itemCount}</span>
        </div>
        <div className="flex justify-between text-lg font-semibold">
          <span>Subtotal</span>
          <span data-testid="cart-subtotal">{formatRs(subtotal)}</span>
        </div>
        <Button
          size="lg"
          disabled={!preview.priced}
          onClick={() => {
            setPaying(true);
          }}
        >
          Proceed to Payment
        </Button>
      </div>
      <PaymentDialog open={paying} onOpenChange={setPaying} preview={preview} sale={sale} />
    </aside>
  );
}
