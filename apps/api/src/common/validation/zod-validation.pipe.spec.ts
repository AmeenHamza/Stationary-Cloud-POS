import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { AppError } from '../errors/app-error';

import { ZodValidationPipe } from './zod-validation.pipe';

const schema = z.object({
  name: z.string().trim().min(1, { error: 'Name is required' }),
  lines: z.array(
    z.object({ quantity: z.number().int().positive({ error: 'Quantity must be positive' }) }),
  ),
});

function failure(value: unknown): AppError {
  try {
    new ZodValidationPipe(schema).transform(value);
  } catch (error) {
    if (error instanceof AppError) {
      return error;
    }
  }
  throw new Error('expected an AppError');
}

describe('ZodValidationPipe', () => {
  it('returns the parsed value (trimmed)', () => {
    expect(new ZodValidationPipe(schema).transform({ name: ' Pen ', lines: [] })).toEqual({
      name: 'Pen',
      lines: [],
    });
  });

  it('reports BAD_USER_INPUT with one message per field path', () => {
    const error = failure({ name: ' ', lines: [{ quantity: 2 }, { quantity: -1 }] });
    expect(error.code).toBe('BAD_USER_INPUT');
    expect(error.details).toEqual({
      fieldErrors: { name: 'Name is required', 'lines.1.quantity': 'Quantity must be positive' },
    });
  });

  it('keeps only the first message for a field and uses "_" for the root', () => {
    const twoRules = z
      .string()
      .min(5, { error: 'Too short' })
      .regex(/^\d+$/, { error: 'Digits only' });
    try {
      new ZodValidationPipe(twoRules).transform('ab');
    } catch (error) {
      expect(error).toMatchObject({ details: { fieldErrors: { _: 'Too short' } } });
    }
    expect.assertions(1);
  });
});
