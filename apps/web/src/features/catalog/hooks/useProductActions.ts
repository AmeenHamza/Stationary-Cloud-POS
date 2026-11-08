'use client';

import { useCallback, useState } from 'react';

import { useArchiveToggle } from './useArchiveToggle';
import { useDeleteProduct } from './useDeleteProduct';

import type { OpenDialog } from '../components/ProductDialogs';
import type { ProductAction } from '../components/ProductRowActions';
import type { CatalogProduct } from '../product';

/** Dialog state shared by the product screens (products list, low stock). */
export function useProductActions() {
  const [open, setOpen] = useState<OpenDialog>(null);
  const archiveToggle = useArchiveToggle();
  const deletion = useDeleteProduct();
  const ask = archiveToggle.ask;
  const askDelete = deletion.ask;
  const onAction = useCallback(
    (action: ProductAction, product: CatalogProduct) => {
      if (action === 'archive' || action === 'restore') {
        ask(product);
      } else if (action === 'delete') {
        askDelete(product);
      } else {
        setOpen({ kind: action, product });
      }
    },
    [ask, askDelete],
  );
  return {
    open,
    archiveToggle,
    deletion,
    onAction,
    create: () => {
      setOpen({ kind: 'create' });
    },
    close: () => {
      setOpen(null);
    },
  };
}
