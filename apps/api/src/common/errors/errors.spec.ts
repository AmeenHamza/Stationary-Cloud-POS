import { GraphQLError, type GraphQLFormattedError } from 'graphql';
import { describe, expect, it } from 'vitest';

import { DomainRuleError } from '@pos/domain';

import { AppError, httpStatusFor } from './app-error';
import { formatGraphQLError, INTERNAL_MESSAGE } from './graphql-error.formatter';
import {
  isRetryableTransactionError,
  isUniqueViolation,
  mapPrismaError,
} from './prisma-error.mapper';

const formatted: GraphQLFormattedError = {
  message: 'raw message',
  locations: [{ line: 1, column: 3 }],
  path: ['createSale'],
  extensions: { code: 'INTERNAL_SERVER_ERROR', stacktrace: ['at secret.ts:1'] },
};

/** Apollo hands formatError the original error wrapped in a GraphQLError with the field path. */
const fromResolver = (original: Error): GraphQLError =>
  new GraphQLError(original.message, { originalError: original, path: ['createSale'] });

describe('formatGraphQLError', () => {
  it('keeps the code and safe details of an AppError', () => {
    const error = new AppError('QUOTE_MISMATCH', 'Prices changed.', { quote: { total: '10.00' } });
    expect(formatGraphQLError(formatted, fromResolver(error))).toEqual({
      message: 'Prices changed.',
      locations: formatted.locations,
      path: formatted.path,
      extensions: { code: 'QUOTE_MISMATCH', quote: { total: '10.00' } },
    });
  });

  it('turns a DomainRuleError into field errors', () => {
    const error = new DomainRuleError('BAD_USER_INPUT', 'Discount is too large', 'discount');
    expect(formatGraphQLError(formatted, fromResolver(error)).extensions).toEqual({
      code: 'BAD_USER_INPUT',
      fieldErrors: { discount: 'Discount is too large' },
    });
  });

  it('reports request errors as BAD_USER_INPUT with their message', () => {
    const invalid = {
      message: 'Cannot query field "x".',
      extensions: { code: 'GRAPHQL_VALIDATION_FAILED' },
    };
    expect(formatGraphQLError(invalid, new GraphQLError(invalid.message))).toEqual({
      message: 'Cannot query field "x".',
      extensions: { code: 'BAD_USER_INPUT' },
    });
  });

  it('masks anything unexpected, dropping stack traces and SQL', () => {
    const leaked = new Error('relation "orders" violates check constraint at 10.0.0.5');
    const result = formatGraphQLError(formatted, fromResolver(leaked));
    expect(result).toEqual({
      message: INTERNAL_MESSAGE,
      locations: formatted.locations,
      path: formatted.path,
      extensions: { code: 'INTERNAL_SERVER_ERROR' },
    });
    expect(JSON.stringify(result)).not.toMatch(/orders|secret\.ts|10\.0\.0\.5/);
  });

  it('maps unique violations to CONFLICT and missing records to NOT_FOUND', () => {
    expect(mapPrismaError({ code: 'P2002' })?.code).toBe('CONFLICT');
    expect(mapPrismaError({ code: 'P2025' })?.code).toBe('NOT_FOUND');
    expect(mapPrismaError({ code: 'P1001' })).toBeNull();
    expect(mapPrismaError('boom')).toBeNull();
  });
});

describe('Prisma error predicates', () => {
  it('recognises serialization failures and deadlocks only', () => {
    expect(isRetryableTransactionError({ code: 'P2034' })).toBe(true);
    expect(isRetryableTransactionError({ meta: { driverAdapterError: { code: '40001' } } })).toBe(
      true,
    );
    expect(isRetryableTransactionError({ message: 'deadlock detected (40P01)' })).toBe(true);
    expect(isRetryableTransactionError({ code: 'P2002', message: 'unique' })).toBe(false);
    expect(isRetryableTransactionError(null)).toBe(false);
    expect(isRetryableTransactionError(new Error('timeout'))).toBe(false);
  });

  it('matches unique violations, optionally by target', () => {
    const error = { code: 'P2002', meta: { target: ['username'] } };
    expect(isUniqueViolation(error)).toBe(true);
    expect(isUniqueViolation(error, 'username')).toBe(true);
    expect(isUniqueViolation(error, 'phone')).toBe(false);
    expect(isUniqueViolation({ code: 'P2025' })).toBe(false);
  });
});

describe('httpStatusFor', () => {
  it.each([
    ['UNAUTHENTICATED', 401],
    ['FORBIDDEN', 403],
    ['NOT_FOUND', 404],
    ['RATE_LIMITED', 429],
    ['INTERNAL_SERVER_ERROR', 500],
    ['AI_UNAVAILABLE', 503],
    ['QUOTE_MISMATCH', 409],
    ['LAST_ADMIN', 409],
    ['BAD_USER_INPUT', 400],
    ['BAD_CURSOR', 400],
  ] as const)('%s → %i', (code, status) => {
    expect(httpStatusFor(code)).toBe(status);
  });
});
