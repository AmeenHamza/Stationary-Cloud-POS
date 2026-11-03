'use client';

import { useMutation } from '@apollo/client/react';
import { useState } from 'react';
import { toast } from 'sonner';

import { userMessageOf } from '@/lib/errors/graphql-error';

import { DeleteCategoryDocument } from '../graphql/categories.documents';

import type { CategoryFieldsFragment } from '@/graphql/__generated__/graphql';

/** Delete with confirmation; the category's products move to Uncategorised (Q16b). */
export function useDeleteCategory() {
  const [target, setTarget] = useState<CategoryFieldsFragment | null>(null);
  const [remove, { loading }] = useMutation(DeleteCategoryDocument, {
    refetchQueries: ['Categories', 'CategoryOptions', 'Products'],
  });
  const confirm = async (): Promise<void> => {
    if (target === null) {
      return;
    }
    try {
      await remove({ variables: { id: target.id } });
      toast.success(`${target.name} deleted.`);
    } catch (error) {
      toast.error(userMessageOf(error));
    } finally {
      setTarget(null);
    }
  };
  const count = target?.productCount ?? 0;
  return {
    target,
    ask: setTarget,
    cancel: () => {
      setTarget(null);
    },
    confirm,
    busy: loading,
    title: target === null ? '' : `Delete ${target.name}?`,
    description:
      count === 0
        ? 'The category has no products.'
        : `Its ${String(count)} product${count === 1 ? '' : 's'} move to Uncategorised.`,
  };
}
