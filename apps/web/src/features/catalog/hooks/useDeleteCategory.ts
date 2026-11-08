'use client';

import { useMutation } from '@apollo/client/react';

import { useConfirmedDelete } from '@/hooks/useConfirmedDelete';

import { DeleteCategoryDocument } from '../graphql/categories.documents';

import type { CategoryFieldsFragment } from '@/graphql/__generated__/graphql';

/** Delete with confirmation; the category's products move to Uncategorised (Q16b). */
export function useDeleteCategory() {
  const [remove] = useMutation(DeleteCategoryDocument, {
    refetchQueries: ['Categories', 'CategoryOptions', 'Products'],
  });
  const control = useConfirmedDelete<CategoryFieldsFragment>({
    nameOf: (category) => category.name,
    remove: (category) => remove({ variables: { id: category.id } }),
  });
  const count = control.target?.productCount ?? 0;
  return {
    control,
    description:
      count === 0
        ? 'The category has no products.'
        : `Its ${String(count)} product${count === 1 ? '' : 's'} move to Uncategorised.`,
  };
}
