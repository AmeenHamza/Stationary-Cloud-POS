'use client';

import { PackageIcon } from 'lucide-react';
import { useState } from 'react';

import { MAX_QUANTITY_PER_LINE } from '@pos/contracts';
import { formatRs } from '@pos/domain';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { stockLabel } from '@/features/catalog';

import { useCart } from '../state/CartProvider';

import type { SaleProductFieldsFragment as SaleProduct } from '@/graphql/__generated__/graphql';

/** A product tile (F-18): stock, name and price. A tap adds a piece; "+ Box" adds a box (D-17). */
export function ProductTile({ product }: { product: SaleProduct }) {
  const { dispatch } = useCart();
  const [qty, setQty] = useState(1);
  const stock = stockLabel(product);
  const quantity = Math.min(Math.max(qty, 1), MAX_QUANTITY_PER_LINE);
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 shadow-xs">
      <button
        type="button"
        className="flex flex-1 flex-col items-start gap-1 text-left"
        aria-label={`Add ${product.name}`}
        onClick={() => {
          dispatch({ type: 'addMany', productId: product.id, unit: 'PIECE', quantity });
        }}
      >
        <Badge variant={product.isLowStock ? 'destructive' : 'muted'}>{stock.pieces}</Badge>
        <span className="line-clamp-2 font-medium">{product.name}</span>
        {product.nameUrdu !== null && (
          <span dir="rtl" className="text-sm text-muted-foreground">
            {product.nameUrdu}
          </span>
        )}
        <span className="mt-auto font-semibold text-primary">{formatRs(product.salePrice)}</span>
      </button>
      <div className="grid grid-cols-[76px_1fr] gap-2">
        <Input
          className="h-8 text-center"
          inputMode="numeric"
          aria-label={`Quantity of ${product.name}`}
          value={String(quantity)}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, '').slice(0, 6);
            setQty(digits === '' ? 1 : Number.parseInt(digits, 10));
          }}
        />
        <Button
          size="sm"
          variant="outline"
          aria-label={`Add ${String(quantity)} pieces of ${product.name}`}
          onClick={() => {
            dispatch({ type: 'addMany', productId: product.id, unit: 'PIECE', quantity });
          }}
        >
          Add {quantity}
        </Button>
      </div>
      {product.boxPrice !== null && (
        <Button
          size="sm"
          variant="outline"
          aria-label={`Add ${String(quantity)} boxes of ${product.name}`}
          onClick={() => {
            dispatch({ type: 'addMany', productId: product.id, unit: 'BOX', quantity });
          }}
        >
          <PackageIcon /> Add {quantity} box{quantity === 1 ? '' : 'es'} · {formatRs(product.boxPrice)}
        </Button>
      )}
    </div>
  );
}
