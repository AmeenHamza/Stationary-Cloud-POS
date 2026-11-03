import { GraphQLError, GraphQLScalarType, Kind } from 'graphql';

import {
  Decimal,
  isBusinessDate,
  isMoneyString,
  isPercentString,
  toMoneyString,
} from '@pos/domain';

/** A Money/Percent value before serialization: a Prisma Decimal or an exact decimal string. */
export type DecimalLike = string | { toString: () => string };

/** The two-decimal wire text of a Money or Percent value, for event payloads (API.md §2, §7). */
export function moneyText(value: DecimalLike): string {
  return toMoneyString(new Decimal(value.toString()));
}

/**
 * Custom scalars (API.md §2). Money and Percent travel as decimal strings, never floats.
 * Built by one factory so the three scalars share their parsing behaviour.
 */
function stringScalar(
  name: string,
  description: string,
  isValid: (value: string) => boolean,
  serialize: (value: string) => string,
): GraphQLScalarType<string, string> {
  const parse = (value: unknown): string => {
    if (typeof value !== 'string' || !isValid(value.trim())) {
      throw new GraphQLError(`${name} value is invalid.`, {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }
    return value.trim();
  };
  return new GraphQLScalarType<string, string>({
    name,
    description,
    // Values come from the database as Decimal objects or strings; both stringify exactly.
    serialize: (value) => serialize(String(value)),
    parseValue: parse,
    parseLiteral: (ast) => (ast.kind === Kind.STRING ? parse(ast.value) : parse(null)),
  });
}

export const MoneyScalar = stringScalar(
  'Money',
  'Decimal amount in rupees as a string with exactly two decimals, e.g. "283.20".',
  isMoneyString,
  (value) => toMoneyString(new Decimal(value)),
);

export const PercentScalar = stringScalar(
  'Percent',
  'Percentage 0–100 as a string with two decimals, e.g. "18.00".',
  isPercentString,
  (value) => new Decimal(value).toFixed(2),
);

export const BusinessDateScalar = stringScalar(
  'BusinessDate',
  'Calendar date YYYY-MM-DD in the business time zone (Asia/Karachi).',
  isBusinessDate,
  (value) => value,
);
