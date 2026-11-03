import { toast } from 'sonner';

import { fieldErrorsOf, userMessageOf } from './graphql-error';

import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

/**
 * Shows a failed mutation on its form: server field errors (API.md §4 `fieldErrors`) land on the
 * matching inputs; anything else becomes a toast with the server's message.
 */
export function applyFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): void {
  const errors = fieldErrorsOf(error);
  let shown = false;
  for (const field of fields) {
    const message = errors[field];
    if (message !== undefined) {
      setError(field, { message });
      shown = true;
    }
  }
  if (!shown) {
    toast.error(userMessageOf(error));
  }
}
