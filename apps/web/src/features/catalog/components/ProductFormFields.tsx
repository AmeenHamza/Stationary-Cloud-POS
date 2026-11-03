'use client';

import { FormSelectField } from '@/components/forms/FormSelectField';
import { FormTextField } from '@/components/forms/FormTextField';

import { useCategoryOptions } from '../hooks/useCategoryOptions';

import type { ProductForm } from '../hooks/useProductForm';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';

interface FieldProps {
  register: UseFormRegister<ProductForm>;
  errors: FieldErrors<ProductForm>;
}

const UNIT_OPTIONS = [
  { value: 'PIECE', label: 'Pieces' },
  { value: 'BOX', label: 'Boxes' },
];
const whole = { valueAsNumber: true } as const;
const nullableId = { setValueAs: (value: string) => (value === '' ? null : value) } as const;

/** Names, barcode and category. */
function IdentityFields({ register, errors }: FieldProps) {
  const categories = useCategoryOptions();
  return (
    <>
      <FormTextField name="name" label="Name" register={register} error={errors.name?.message} />
      <FormTextField
        name="nameUrdu"
        label="Urdu name (optional)"
        dir="rtl"
        lang="ur"
        register={register}
        error={errors.nameUrdu?.message}
      />
      <FormTextField
        name="barcode"
        label="Barcode (optional)"
        autoComplete="off"
        register={register}
        error={errors.barcode?.message}
      />
      <FormSelectField
        name="categoryId"
        label="Category"
        register={register}
        registerOptions={nullableId}
        options={[{ value: '', label: 'Uncategorised' }, ...categories]}
        error={errors.categoryId?.message}
      />
    </>
  );
}

/** Prices, tax, unit and box size (D-17: a box price needs more than one piece per box). */
function PricingFields({ register, errors }: FieldProps) {
  return (
    <>
      <FormTextField
        name="salePrice"
        label="Price per piece (Rs)"
        inputMode="decimal"
        register={register}
        error={errors.salePrice?.message}
      />
      <FormTextField
        name="costPrice"
        label="Cost price (optional)"
        inputMode="decimal"
        register={register}
        error={errors.costPrice?.message}
      />
      <FormTextField
        name="baseUnitLabel"
        label="Base unit"
        placeholder="Piece"
        register={register}
        error={errors.baseUnitLabel?.message}
      />
      <FormTextField
        name="piecesPerBox"
        label="Pieces per box (1 = no box)"
        type="number"
        min={1}
        register={register}
        registerOptions={whole}
        error={errors.piecesPerBox?.message}
      />
      <FormTextField
        name="boxPrice"
        label="Box price (only when pieces per box > 1)"
        inputMode="decimal"
        register={register}
        error={errors.boxPrice?.message}
      />
      <FormTextField
        name="taxRate"
        label="Tax rate %"
        inputMode="decimal"
        register={register}
        error={errors.taxRate?.message}
      />
    </>
  );
}

/**
 * Product form fields (FEATURES.md §3.3). The low-stock threshold is entered in pieces or boxes and
 * stored in pieces (BR-01). Opening stock appears on create only; later changes use Restock.
 */
export function ProductFormFields({ register, errors, isNew }: FieldProps & { isNew: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <IdentityFields register={register} errors={errors} />
      <PricingFields register={register} errors={errors} />
      <FormTextField
        name="lowStockThreshold"
        label="Low-stock alert at"
        type="number"
        min={0}
        register={register}
        registerOptions={whole}
        error={errors.lowStockThreshold?.message}
      />
      <FormSelectField
        name="lowStockThresholdUnit"
        label="Alert unit"
        register={register}
        options={UNIT_OPTIONS}
        error={errors.lowStockThresholdUnit?.message}
      />
      {isNew && (
        <FormTextField
          name="initialStockPieces"
          label="Opening stock (pieces)"
          type="number"
          min={0}
          register={register}
          registerOptions={whole}
          error={errors.initialStockPieces?.message}
        />
      )}
    </div>
  );
}
