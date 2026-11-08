'use client';

import { useMutation } from '@apollo/client/react';

import { useConfirmedDelete } from '@/hooks/useConfirmedDelete';

import { DeleteProductDocument } from '../graphql/products.documents';

import type { CatalogProduct } from '../product';

/**
 * Removes a product from the database (D-28). The server refuses one that is on past bills, because
 * bills are kept for good (D-12); such a product can only be archived.
 */
export function useDeleteProduct() {
  const [remove] = useMutation(DeleteProductDocument, {
    refetchQueries: ['Products', 'LowStockProducts'],
  });
  return useConfirmedDelete<CatalogProduct>({
    nameOf: (product) => product.name,
    remove: (product) => remove({ variables: { id: product.id } }),
  });
}
