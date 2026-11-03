'use client';

import { useId } from 'react';

import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';

import type { FieldValues, Path, RegisterOptions, UseFormRegister } from 'react-hook-form';

/** Labelled native select bound to react-hook-form. */
export function FormSelectField<T extends FieldValues>({
  name,
  label,
  register,
  options,
  error,
  registerOptions,
}: {
  name: Path<T>;
  label: string;
  register: UseFormRegister<T>;
  options: readonly { value: string; label: string }[];
  error?: string | undefined;
  /** e.g. `{ setValueAs }` to turn the empty option into null. */
  registerOptions?: RegisterOptions<T, Path<T>>;
}) {
  const id = useId();
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect id={id} aria-invalid={error !== undefined} {...register(name, registerOptions)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
      {error !== undefined && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
