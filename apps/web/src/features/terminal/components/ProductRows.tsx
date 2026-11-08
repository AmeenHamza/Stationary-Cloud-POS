'use client';

import { PackageIcon } from 'lucide-react';

import { formatRs } from '@pos/domain';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { stockLabel } from '@/features/catalog';
import { cn } from '@/lib/cn';

import { useCart } from '../state/CartProvider';

import type { SaleProductFieldsFragment as SaleProduct } from '@/graphql/__generated__/graphql';

const LOADING_ROWS = 9;
/** Up to three lists side by side, by the picker's own width: a narrow screen gets fewer. */
const LISTS = 'grid gap-x-3 @xl:grid-cols-2 @3xl:grid-cols-3';
const BOX_SLOT = 'w-14 shrink-0';

function ProductRow({ product, boxSlot }: { product: SaleProduct; boxSlot: boolean }) {
  const { dispatch } = useCart();
  return (
    <li
      data-product-id={product.id}
      className="flex overflow-hidden rounded-lg border bg-card transition-colors @container hover:bg-muted/60"
    >
      <button
        type="button"
        aria-label={`Add ${product.name}`}
        className={cn(
          'grid min-w-0 flex-1 cursor-pointer items-center gap-x-2 gap-y-1 px-3 py-2.5 text-left',
          // The name over stock and price; all three on one line, under the headings, with the room.
          'grid-cols-[minmax(0,1fr)_auto] @sm:grid-cols-[minmax(0,1fr)_4.5rem_5.5rem]',
          'outline-none active:bg-muted',
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
          // No Box here, but the page has one: the whole row still adds, in line with those rows.
          boxSlot && product.boxPrice === null && '@sm:pr-17',
        )}
        onClick={() => {
          dispatch({ type: 'add', productId: product.id, unit: 'PIECE' });
        }}
      >
        <span className="col-span-2 min-w-0 @sm:col-span-1">
          <span className="block font-medium wrap-break-word">{product.name}</span>
          {product.nameUrdu !== null && (
            <span dir="rtl" className="block text-sm text-muted-foreground">
              {product.nameUrdu}
            </span>
          )}
        </span>
        <span>
          <Badge variant={product.isLowStock ? 'destructive' : 'muted'}>
            {stockLabel(product).pieces}
          </Badge>
        </span>
        <span className="text-right font-semibold whitespace-nowrap text-primary tabular-nums">
          {formatRs(product.salePrice)}
        </span>
      </button>
      {product.boxPrice !== null && (
        <span className={cn(BOX_SLOT, 'flex border-l')}>
          <Button
            variant="ghost"
            className="h-full w-full flex-col gap-0.5 rounded-none text-xs"
            aria-label={`Add a box of ${product.name}`}
            title={`A box: ${formatRs(product.boxPrice)}`}
            onClick={() => {
              dispatch({ type: 'add', productId: product.id, unit: 'BOX' });
            }}
          >
            <PackageIcon /> Box
          </Button>
        </span>
      )}
    </li>
  );
}

/** Shown over a list only when its rows have the room for one line. */
function Headings({ boxSlot, className }: { boxSlot: boolean; className?: string }) {
  return (
    <div className={cn('@container', className)}>
      <div className="mb-2 hidden text-sm font-medium text-muted-foreground @sm:flex">
        <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_4.5rem_5.5rem] gap-2 px-3">
          <span>Product</span>
          <span>Stock</span>
          <span className="text-right">Price</span>
        </div>
        {boxSlot && <span className={BOX_SLOT} />}
      </div>
    </div>
  );
}

/**
 * The list view of the terminal's products (F-38): compact rows of Product, Stock and Price, up to
 * three lists side by side. A tap anywhere on a row adds a piece, and products with a box price also
 * offer Box (D-17). The rows are the same server page as the cards, so nothing extra is downloaded.
 */
export function ProductRows({
  products,
  loading,
}: {
  products: readonly SaleProduct[];
  loading: boolean;
}) {
  const boxSlot = products.some((product) => product.boxPrice !== null);
  return (
    <div className="@container">
      <div className={LISTS}>
        <Headings boxSlot={boxSlot} />
        <Headings boxSlot={boxSlot} className="hidden @xl:block" />
        <Headings boxSlot={boxSlot} className="hidden @3xl:block" />
      </div>
      <ul className={cn(LISTS, 'gap-y-2')}>
        {products.map((product) => (
          <ProductRow key={product.id} product={product} boxSlot={boxSlot} />
        ))}
        {loading &&
          Array.from({ length: LOADING_ROWS }, (_, index) => (
            <li key={`loading-${String(index)}`} aria-hidden>
              <Skeleton className="h-12 w-full rounded-lg" />
            </li>
          ))}
      </ul>
    </div>
  );
}
