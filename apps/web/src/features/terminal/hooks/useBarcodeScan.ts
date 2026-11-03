'use client';

import { useApolloClient } from '@apollo/client/react';
import { useCallback } from 'react';

import { ProductByBarcodeDocument } from '../graphql/terminal.documents';
import { useCart } from '../state/CartProvider';

/**
 * A scan or a typed code followed by Enter (SYSTEM_DESIGN.md §3.1): an exact barcode match adds one
 * piece (Q22 default) and returns true; otherwise false, and the caller searches by name instead.
 */
export function useBarcodeScan(): (code: string) => Promise<boolean> {
  const client = useApolloClient();
  const { dispatch } = useCart();
  return useCallback(
    async (code: string) => {
      const { data } = await client.query({
        query: ProductByBarcodeDocument,
        variables: { barcode: code },
        fetchPolicy: 'network-only',
      });
      const product = data?.productByBarcode;
      if (product == null) {
        return false;
      }
      dispatch({ type: 'add', productId: product.id, unit: 'PIECE' });
      return true;
    },
    [client, dispatch],
  );
}
