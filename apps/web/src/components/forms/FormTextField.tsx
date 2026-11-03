'use client';

import { useId } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import type { ComponentProps } from 'react';
import type { FieldValues, Path, RegisterOptions, UseFormRegister } from 'react-hook-form';

type InputProps = Omit<ComponentProps<'input'>, 'name' | 'id'>;

interface FormTextFieldProps<T extends FieldValues> extends InputProps {
  name: Path<T>;
  label: string;
  register: UseFormRegister<T>;
  error?: string | undefined;
  /** e.g. `{ valueAsNumber: true }` for whole-number fields. */
  registerOptions?: RegisterOptions<T, Path<T>>;
}

/** Labelled input bound to react-hook-form, with an accessible error message. */
export function FormTextField<T extends FieldValues>({
  name,
  label,
  register,
  error,
  registerOptions,
  ...inputProps
}: FormTextFieldProps<T>) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        aria-invalid={error !== undefined}
        aria-describedby={error === undefined ? undefined : errorId}
        {...inputProps}
        {...register(name, registerOptions)}
      />
      {error !== undefined && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
