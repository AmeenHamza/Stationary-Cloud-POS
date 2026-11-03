'use client';

import { useMutation } from '@apollo/client/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { ADJUSTMENT_REASONS } from '@pos/contracts';
import { adjustStockInputSchema, type AdjustStockInput } from '@pos/validation';

import { FormDialog } from '@/components/forms/FormDialog';
import { FormSelectField } from '@/components/forms/FormSelectField';
import { FormTextField } from '@/components/forms/FormTextField';
import { applyFieldErrors } from '@/lib/errors/apply-field-errors';
import { newIdempotencyKey } from '@/lib/ids/idempotency-key';

import { AdjustStockDocument } from '../graphql/inventory.documents';
import { ADJUSTMENT_REASON_LABEL, type CatalogProduct } from '../product';

import type { z } from 'zod';

type AdjustForm = z.input<typeof adjustStockInputSchema>;

const DIRECTION_OPTIONS = [
  { value: 'DECREASE', label: 'Remove stock' },
  { value: 'INCREASE', label: 'Add stock' },
];
const REASON_OPTIONS = ADJUSTMENT_REASONS.map((reason) => ({
  value: reason,
  label: ADJUSTMENT_REASON_LABEL[reason],
}));

/**
 * Stock adjustment (F-32, D-18): admins correct stock up or down with a required reason; the
 * movement and the audit log record who, why and how much.
 */
export function AdjustStockDialog({
  product,
  onOpenChange,
}: {
  product: CatalogProduct;
  onOpenChange: (open: boolean) => void;
}) {
  const [key] = useState(newIdempotencyKey);
  const [adjust, { loading }] = useMutation(AdjustStockDocument);
  const { register, handleSubmit, formState, setError } = useForm<
    AdjustForm,
    unknown,
    AdjustStockInput
  >({
    resolver: zodResolver(adjustStockInputSchema),
    defaultValues: {
      idempotencyKey: key,
      productId: product.id,
      direction: 'DECREASE',
      quantityPieces: 1,
      reason: 'DAMAGED',
      note: '',
    },
  });
  const errors = formState.errors;
  const submit = handleSubmit(async (input) => {
    try {
      const result = await adjust({ variables: { input } });
      const stock = result.data?.adjustStock.stockPieces ?? product.stockPieces;
      toast.success(`${product.name}: stock is now ${String(stock)} pcs.`);
      onOpenChange(false);
    } catch (error) {
      applyFieldErrors(error, setError, ['direction', 'quantityPieces', 'reason', 'note']);
    }
  });
  return (
    <FormDialog
      open
      onOpenChange={onOpenChange}
      title={`Adjust stock: ${product.name}`}
      description={`Current stock: ${String(product.stockPieces)} pcs. Every adjustment is logged.`}
      submitLabel="Save adjustment"
      busy={loading}
      onSubmit={submit}
    >
      <FormSelectField
        name="direction"
        label="Change"
        register={register}
        options={DIRECTION_OPTIONS}
        error={errors.direction?.message}
      />
      <FormTextField
        name="quantityPieces"
        label="Pieces"
        type="number"
        min={1}
        register={register}
        registerOptions={{ valueAsNumber: true }}
        error={errors.quantityPieces?.message}
      />
      <FormSelectField
        name="reason"
        label="Reason"
        register={register}
        options={REASON_OPTIONS}
        error={errors.reason?.message}
      />
      <FormTextField
        name="note"
        label="Note (optional)"
        register={register}
        error={errors.note?.message}
      />
    </FormDialog>
  );
}
