import { AppError } from '../errors/app-error';

import type { PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

/** First message per field path, e.g. `{ "lines.0.quantity": "…" }` (API.md §4). */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.map(String).join('.') || '_';
    fieldErrors[path] ??= issue.message;
  }
  return fieldErrors;
}

/**
 * Applies a shared `@pos/validation` schema to resolver arguments (ADR-012) and returns the parsed
 * (trimmed, defaulted) value. Failures become BAD_USER_INPUT with field errors.
 */
export class ZodValidationPipe<Schema extends z.ZodType> implements PipeTransform {
  constructor(private readonly schema: Schema) {}

  transform(value: unknown): z.output<Schema> {
    const result = this.schema.safeParse(value);
    if (result.success) {
      return result.data;
    }
    throw new AppError('BAD_USER_INPUT', 'Some fields are invalid.', {
      fieldErrors: toFieldErrors(result.error),
    });
  }
}
