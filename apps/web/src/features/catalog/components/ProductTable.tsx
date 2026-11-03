'use client';

import { memo } from 'react';

import { isOutOfStock, piecesToThreshold } from '@pos/domain';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { priceLabel, stockLabel, type CatalogProduct } from '../product';

import { ProductRowActions, type ProductAction } from './ProductRowActions';

function StatusBadge({ product }: { product: CatalogProduct }) {
  if (product.archivedAt !== null) {
    return <Badge variant="muted">Archived</Badge>;
  }
  if (isOutOfStock(product.stockPieces)) {
    return <Badge variant="destructive">Out of stock</Badge>;
  }
  return product.isLowStock ? <Badge variant="destructive">Low stock</Badge> : null;
}

/** Memoized: a live stock patch re-renders only the row whose product changed. */
const ProductRow = memo(function ProductRow({
  product,
  onAction,
}: {
  product: CatalogProduct;
  onAction: (action: ProductAction, product: CatalogProduct) => void;
}) {
  const stock = stockLabel(product);
  const price = priceLabel(product);
  const unit = product.lowStockThresholdUnit === 'BOX' ? 'boxes' : 'pcs';
  const alertAt = piecesToThreshold(
    product.lowStockThresholdPieces,
    product.lowStockThresholdUnit,
    product.piecesPerBox,
  );
  return (
    <TableRow data-product-id={product.id}>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {product.barcode ?? '—'}
      </TableCell>
      <TableCell>
        <div className="font-medium">{product.name}</div>
        {product.nameUrdu !== null && (
          <div dir="rtl" lang="ur" className="text-sm text-muted-foreground">
            {product.nameUrdu}
          </div>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {product.categoryName ?? 'Uncategorised'}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <div>{price.piece}</div>
        {price.box !== null && <div className="text-xs text-muted-foreground">{price.box}</div>}
      </TableCell>
      <TableCell className="text-right tabular-nums" data-testid="stock">
        <div>{stock.pieces}</div>
        {stock.boxes !== null && <div className="text-xs text-muted-foreground">{stock.boxes}</div>}
      </TableCell>
      <TableCell className="text-right tabular-nums text-muted-foreground">
        {alertAt} {unit}
      </TableCell>
      <TableCell>
        <StatusBadge product={product} />
      </TableCell>
      <TableCell className="text-right">
        <ProductRowActions product={product} onAction={onAction} />
      </TableCell>
    </TableRow>
  );
});

/** One page of products (FEATURES.md §3.3 columns) with a row menu per product. */
export function ProductTable({
  products,
  onAction,
}: {
  products: readonly CatalogProduct[];
  onAction: (action: ProductAction, product: CatalogProduct) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Barcode</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Category</TableHead>
          <TableHead className="text-right">Price</TableHead>
          <TableHead className="text-right">Stock</TableHead>
          <TableHead className="text-right">Alert at</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => (
          <ProductRow key={product.id} product={product} onAction={onAction} />
        ))}
      </TableBody>
    </Table>
  );
}
