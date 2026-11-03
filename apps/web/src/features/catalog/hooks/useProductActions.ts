'use client';

import { useCallback, useState } from 'react';

import { useArchiveToggle } from './useArchiveToggle';

import type { OpenDialog } from '../components/ProductDialogs';
import type { ProductAction } from '../components/ProductRowActions';
import type { CatalogProduct } from '../product';

/** Dialog state shared by the product screens (products list, low stock). */
export function useProductActions() {
  const [open, setOpen] = useState<OpenDialog>(null);
  const archiveToggle = useArchiveToggle();
  const ask = archiveToggle.ask;
  const onAction = useCallback(
    (action: ProductAction, product: CatalogProduct) => {
      if (action === 'archive' || action === 'restore') {
        ask(product);
      } else {
        setOpen({ kind: action, product });
      }
    },
    [ask],
  );
  return {
    open,
    archiveToggle,
    onAction,
    create: () => {
      setOpen({ kind: 'create' });
    },
    close: () => {
      setOpen(null);
    },
  };
}
