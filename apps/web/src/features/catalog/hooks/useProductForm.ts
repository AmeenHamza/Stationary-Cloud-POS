'use client';

import { useMutation } from '@apollo/client/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { piecesToThreshold } from '@pos/domain';
import { createProductInputSchema, updateProductInputSchema } from '@pos/validation';

import { applyFieldErrors } from '@/lib/errors/apply-field-errors';
import { newIdempotencyKey } from '@/lib/ids/idempotency-key';

import { CreateProductDocument, UpdateProductDocument } from '../graphql/products.documents';

import type { ProductForEditQuery } from '@/graphql/__generated__/graphql';
import type { z } from 'zod';

export type ProductForm = z.input<typeof createProductInputSchema>;
type ProductValues = z.output<typeof createProductInputSchema>;
export type EditableProduct = NonNullable<ProductForEditQuery['product']>;

const FIELDS = [
  'barcode',
  'name',
  'nameUrdu',
  'categoryId',
  'baseUnitLabel',
  'piecesPerBox',
  'salePrice',
  'boxPrice',
  'costPrice',
  'taxRate',
  'lowStockThreshold',
  'lowStockThresholdUnit',
  'initialStockPieces',
] as const;

function emptyForm(categoryId: string | null): ProductForm {
  return {
    idempotencyKey: newIdempotencyKey(),
    barcode: '',
    name: '',
    nameUrdu: '',
    categoryId,
    baseUnitLabel: 'Piece',
    piecesPerBox: 1,
    salePrice: '',
    boxPrice: '',
    costPrice: '',
    taxRate: '0',
    lowStockThreshold: 10,
    lowStockThresholdUnit: 'PIECE',
    initialStockPieces: 0,
  };
}

/** Form values for an existing product; stock is not edited here (BR-03). */
function formOf(product: EditableProduct): ProductForm {
  return {
    ...emptyForm(product.categoryId),
    barcode: product.barcode ?? '',
    name: product.name,
    nameUrdu: product.nameUrdu ?? '',
    baseUnitLabel: product.baseUnitLabel,
    piecesPerBox: product.piecesPerBox,
    salePrice: product.salePrice,
    boxPrice: product.boxPrice ?? '',
    costPrice: product.costPrice ?? '',
    taxRate: product.taxRate,
    lowStockThreshold: piecesToThreshold(
      product.lowStockThresholdPieces,
      product.lowStockThresholdUnit,
      product.piecesPerBox,
    ),
    lowStockThresholdUnit: product.lowStockThresholdUnit,
  };
}

/**
 * Create or edit a product (F-08) with the shared schema (rule 4). A create keeps one idempotency
 * key per opened form, so a retried submit cannot add the product twice.
 */
export function useProductForm(
  editing: EditableProduct | null,
  defaultCategoryId: string | null,
  onDone: () => void,
) {
  const form = useForm<ProductForm, unknown, ProductValues>({
    resolver: zodResolver(createProductInputSchema),
    defaultValues: editing === null ? emptyForm(defaultCategoryId) : formOf(editing),
  });
  const [create, created] = useMutation(CreateProductDocument, {
    refetchQueries: ['Products', 'Categories'],
  });
  const [update, updated] = useMutation(UpdateProductDocument);

  const submit = form.handleSubmit(async (values) => {
    try {
      if (editing === null) {
        await create({ variables: { input: values } });
        toast.success(`${values.name} added.`);
        form.reset(emptyForm(defaultCategoryId));
      } else {
        // Re-parsing with the update schema drops the create-only fields.
        const input = updateProductInputSchema.parse({
          ...values,
          id: editing.id,
          version: editing.version,
        });
        await update({ variables: { input } });
        toast.success(`${values.name} saved.`);
      }
      onDone();
    } catch (error) {
      applyFieldErrors(error, form.setError, FIELDS);
    }
  });

  return { form, submit, busy: created.loading || updated.loading };
}
