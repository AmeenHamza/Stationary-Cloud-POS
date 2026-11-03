'use client';

import { useMutation } from '@apollo/client/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { createCategoryInputSchema, type CreateCategoryInput } from '@pos/validation';

import { FormDialog } from '@/components/forms/FormDialog';
import { FormTextField } from '@/components/forms/FormTextField';
import { applyFieldErrors } from '@/lib/errors/apply-field-errors';

import { CreateCategoryDocument, UpdateCategoryDocument } from '../graphql/categories.documents';

import type { CategoryFieldsFragment } from '@/graphql/__generated__/graphql';
import type { z } from 'zod';

type CategoryForm = z.input<typeof createCategoryInputSchema>;

/** Add or edit a category (F-12): name, optional emoji icon and description. */
export function CategoryFormDialog({
  category,
  onOpenChange,
}: {
  category: CategoryFieldsFragment | null;
  onOpenChange: (open: boolean) => void;
}) {
  const refetch = { refetchQueries: ['Categories', 'CategoryOptions'] };
  const [create, created] = useMutation(CreateCategoryDocument, refetch);
  const [update, updated] = useMutation(UpdateCategoryDocument, refetch);
  const { register, handleSubmit, formState, setError } = useForm<
    CategoryForm,
    unknown,
    CreateCategoryInput
  >({
    resolver: zodResolver(createCategoryInputSchema),
    defaultValues: {
      name: category?.name ?? '',
      iconEmoji: category?.iconEmoji ?? '',
      description: category?.description ?? '',
    },
  });
  const submit = handleSubmit(async (input) => {
    try {
      if (category === null) {
        await create({ variables: { input } });
      } else {
        await update({
          variables: { input: { ...input, id: category.id, version: category.version } },
        });
      }
      toast.success(`${input.name} saved.`);
      onOpenChange(false);
    } catch (error) {
      applyFieldErrors(error, setError, ['name', 'iconEmoji', 'description']);
    }
  });
  const errors = formState.errors;
  return (
    <FormDialog
      open
      onOpenChange={onOpenChange}
      title={category === null ? 'Add category' : `Edit ${category.name}`}
      submitLabel={category === null ? 'Add category' : 'Save'}
      busy={created.loading || updated.loading}
      onSubmit={submit}
    >
      <FormTextField name="name" label="Name" register={register} error={errors.name?.message} />
      <FormTextField
        name="iconEmoji"
        label="Icon (emoji, optional)"
        placeholder="✏️"
        register={register}
        error={errors.iconEmoji?.message}
      />
      <FormTextField
        name="description"
        label="Description (optional)"
        register={register}
        error={errors.description?.message}
      />
    </FormDialog>
  );
}
