'use client';

import { useMutation } from '@apollo/client/react';
import { useState } from 'react';
import { toast } from 'sonner';

import { userMessageOf } from '@/lib/errors/graphql-error';

import { ArchiveProductDocument, RestoreProductDocument } from '../graphql/products.documents';

import type { CatalogProduct } from '../product';

/**
 * Archive or restore with a confirmation step (Q16b: products are never deleted, because orders and
 * the stock ledger reference them). Restoring fails if another active product took the barcode.
 */
export function useArchiveToggle() {
  const [target, setTarget] = useState<CatalogProduct | null>(null);
  const refetch = { refetchQueries: ['Products', 'LowStockProducts'] };
  const [archive, archiving] = useMutation(ArchiveProductDocument, refetch);
  const [restore, restoring] = useMutation(RestoreProductDocument, refetch);
  const archived = target?.archivedAt != null;

  const confirm = async (): Promise<void> => {
    if (target === null) {
      return;
    }
    try {
      const variables = { id: target.id };
      await (archived ? restore({ variables }) : archive({ variables }));
      toast.success(archived ? `${target.name} is back on sale.` : `${target.name} is archived.`);
    } catch (error) {
      toast.error(userMessageOf(error));
    } finally {
      setTarget(null);
    }
  };

  return {
    target,
    ask: setTarget,
    cancel: () => {
      setTarget(null);
    },
    confirm,
    busy: archiving.loading || restoring.loading,
    title: target === null ? '' : `${archived ? 'Restore' : 'Archive'} ${target.name}?`,
    description: archived
      ? 'It returns to the terminal and product lists.'
      : 'It leaves the terminal and product lists. Past bills keep it; you can restore it later.',
    confirmLabel: archived ? 'Restore' : 'Archive',
    destructive: !archived,
  };
}
