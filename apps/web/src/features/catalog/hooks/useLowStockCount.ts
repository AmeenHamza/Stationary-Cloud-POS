'use client';

import { useQuery } from '@apollo/client/react';

import { LowStockCountDocument } from '../graphql/inventory.documents';

/**
 * Active products at or below their threshold (F-13): one COUNT shared by the sidebar badge and
 * the dashboard tile, refreshed by `lowStock.countChanged` only. Null until loaded.
 */
export function useLowStockCount(): number | null {
  const { data } = useQuery(LowStockCountDocument);
  return data?.lowStockCount ?? null;
}
