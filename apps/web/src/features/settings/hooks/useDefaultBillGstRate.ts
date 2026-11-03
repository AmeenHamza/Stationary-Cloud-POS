'use client';

import { useQuery } from '@apollo/client/react';

import { ShopSettingsDocument } from '../graphql/settings.documents';

/**
 * The shop's default Bill GST rate (Q26), from the cached shop profile; `settings.changed` refetches
 * it. Null until loaded.
 */
export function useDefaultBillGstRate(): string | null {
  const { data } = useQuery(ShopSettingsDocument);
  return data?.shopSettings.defaultBillGstRate ?? null;
}
