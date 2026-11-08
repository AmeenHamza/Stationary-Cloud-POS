'use client';

import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { DeleteConfirm } from '@/components/feedback/DeleteConfirm';

import { AdjustStockDialog } from './AdjustStockDialog';
import { CloneProductDialog } from './CloneProductDialog';
import { ProductFormDialog } from './ProductFormDialog';
import { RestockDialog } from './RestockDialog';

import type { useArchiveToggle } from '../hooks/useArchiveToggle';
import type { useDeleteProduct } from '../hooks/useDeleteProduct';
import type { CatalogProduct } from '../product';
import type { ProductAction } from './ProductRowActions';

/** Which product dialog is open; `create` has no product yet. */
export type OpenDialog =
  | { kind: 'create' }
  | { kind: Exclude<ProductAction, 'archive' | 'restore' | 'delete'>; product: CatalogProduct }
  | null;

/**
 * The dialogs of the product screens: add/edit, clone, restock, adjust, and the archive/restore and
 * delete confirmations. Opening one replaces any other.
 */
export function ProductDialogs({
  open,
  onClose,
  archiveToggle,
  deletion,
  defaultCategoryId,
}: {
  open: OpenDialog;
  onClose: () => void;
  archiveToggle: ReturnType<typeof useArchiveToggle>;
  deletion: ReturnType<typeof useDeleteProduct>;
  defaultCategoryId: string | null;
}) {
  const close = (isOpen: boolean): void => {
    if (!isOpen) onClose();
  };
  const toggle = archiveToggle;
  return (
    <>
      {open?.kind === 'create' && (
        <ProductFormDialog
          productId={null}
          defaultCategoryId={defaultCategoryId}
          onOpenChange={close}
        />
      )}
      {open?.kind === 'edit' && (
        <ProductFormDialog
          key={open.product.id}
          productId={open.product.id}
          defaultCategoryId={null}
          onOpenChange={close}
        />
      )}
      {open?.kind === 'clone' && <CloneProductDialog product={open.product} onOpenChange={close} />}
      {open?.kind === 'restock' && <RestockDialog product={open.product} onOpenChange={close} />}
      {open?.kind === 'adjust' && <AdjustStockDialog product={open.product} onOpenChange={close} />}
      <ConfirmDialog
        open={toggle.target !== null}
        title={toggle.title}
        description={toggle.description}
        confirmLabel={toggle.confirmLabel}
        destructive={toggle.destructive}
        busy={toggle.busy}
        onConfirm={() => void toggle.confirm()}
        onOpenChange={(isOpen) => {
          if (!isOpen) toggle.cancel();
        }}
      />
      <DeleteConfirm
        control={deletion}
        description="This removes the product and its stock history from the database for good. A product on past bills cannot be deleted: archive it instead."
      />
    </>
  );
}
