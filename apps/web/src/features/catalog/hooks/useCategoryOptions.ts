'use client';

import { useQuery } from '@apollo/client/react';

import { CategoryOptionsDocument } from '../graphql/categories.documents';

/** Category choices `{ value: id, label }` for selects, from the first page of 50 (cache-first). */
export function useCategoryOptions(): { value: string; label: string }[] {
  const { data } = useQuery(CategoryOptionsDocument);
  return (data?.categories.nodes ?? []).map((category) => ({
    value: category.id,
    label: category.iconEmoji === null ? category.name : `${category.iconEmoji} ${category.name}`,
  }));
}
