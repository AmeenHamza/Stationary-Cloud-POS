'use client';

import { useMutation } from '@apollo/client/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';

import { restockPieces } from '@pos/domain';
import { restockInputSchema, type RestockInput } from '@pos/validation';

import { FormDialog } from '@/components/forms/FormDialog';
import { FormTextField } from '@/components/forms/FormTextField';
import { applyFieldErrors } from '@/lib/errors/apply-field-errors';
import { newIdempotencyKey } from '@/lib/ids/idempotency-key';

import { RestockProductDocument } from '../graphql/inventory.documents';

import type { CatalogProduct } from '../product';
import type { z } from 'zod';

type RestockForm = z.input<typeof restockInputSchema>;
const whole = { valueAsNumber: true } as const;

/** A whole-number field's value; empty or invalid input counts as 0 for the preview. */
const wholeOrZero = (value: unknown): number =>
  typeof value === 'number' && Number.isInteger(value) ? value : 0;

/** Pieces the entered quantities add, or 0 while they are not a valid restock. */
function addedPieces(boxes: unknown, pieces: unknown, piecesPerBox: number): number {
  try {
    return restockPieces(wholeOrZero(boxes), wholeOrZero(pieces), piecesPerBox);
  } catch {
    return 0;
  }
}

/** Restock (F-10): loose pieces, plus whole boxes when the product comes in boxes; live preview. */
export function RestockDialog({
  product,
  onOpenChange,
}: {
  product: CatalogProduct;
  onOpenChange: (open: boolean) => void;
}) {
  const [key] = useState(newIdempotencyKey);
  const [restock, { loading }] = useMutation(RestockProductDocument);
  const { register, handleSubmit, formState, setError, control } = useForm<
    RestockForm,
    unknown,
    RestockInput
  >({
    resolver: zodResolver(restockInputSchema),
    defaultValues: { idempotencyKey: key, productId: product.id, boxes: 0, pieces: 0, note: '' },
  });
  const [boxes, pieces] = useWatch({ control, name: ['boxes', 'pieces'] });
  const adding = addedPieces(boxes, pieces, product.piecesPerBox);
  const submit = handleSubmit(async (input) => {
    try {
      const result = await restock({ variables: { input } });
      const stock = result.data?.restockProduct.stockPieces ?? product.stockPieces;
      toast.success(`${product.name}: stock is now ${String(stock)} pcs.`);
      onOpenChange(false);
    } catch (error) {
      applyFieldErrors(error, setError, ['boxes', 'pieces', 'note']);
    }
  });
  return (
    <FormDialog
      open
      onOpenChange={onOpenChange}
      title={`Restock ${product.name}`}
      description={`Current stock: ${String(product.stockPieces)} pcs.`}
      submitLabel="Add stock"
      busy={loading}
      onSubmit={submit}
    >
      {product.piecesPerBox > 1 && (
        <FormTextField
          name="boxes"
          label={`Boxes (${String(product.piecesPerBox)} pcs each)`}
          type="number"
          min={0}
          register={register}
          registerOptions={whole}
          error={formState.errors.boxes?.message}
        />
      )}
      <FormTextField
        name="pieces"
        label="Loose pieces"
        type="number"
        min={0}
        register={register}
        registerOptions={whole}
        error={formState.errors.pieces?.message}
      />
      <FormTextField
        name="note"
        label="Note (optional)"
        register={register}
        error={formState.errors.note?.message}
      />
      <p className="rounded-lg bg-muted px-3 py-2 text-sm" aria-live="polite">
        Adding <strong>{adding} pcs</strong> · New total{' '}
        <strong>{product.stockPieces + adding} pcs</strong>
      </p>
    </FormDialog>
  );
}
