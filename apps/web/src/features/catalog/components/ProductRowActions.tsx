'use client';

import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  CopyIcon,
  EllipsisVerticalIcon,
  PackagePlusIcon,
  PencilIcon,
  SlidersHorizontalIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import type { CatalogProduct } from '../product';

export type ProductAction = 'edit' | 'clone' | 'restock' | 'adjust' | 'archive' | 'restore';

/** Row menu of the product tables. Archived products can only be edited or restored. */
export function ProductRowActions({
  product,
  onAction,
}: {
  product: CatalogProduct;
  onAction: (action: ProductAction, product: CatalogProduct) => void;
}) {
  const archived = product.archivedAt !== null;
  const item = (action: ProductAction) => () => {
    onAction(action, product);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Actions for ${product.name}`}>
          <EllipsisVerticalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={item('edit')}>
          <PencilIcon /> Edit
        </DropdownMenuItem>
        {!archived && (
          <>
            <DropdownMenuItem onSelect={item('restock')}>
              <PackagePlusIcon /> Restock
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={item('adjust')}>
              <SlidersHorizontalIcon /> Adjust stock
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={item('clone')}>
              <CopyIcon /> Clone with new barcode
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        {archived ? (
          <DropdownMenuItem onSelect={item('restore')}>
            <ArchiveRestoreIcon /> Restore
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem variant="destructive" onSelect={item('archive')}>
            <ArchiveIcon /> Archive
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
