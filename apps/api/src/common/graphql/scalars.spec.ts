import { Kind, type ValueNode } from 'graphql';
import { describe, expect, it } from 'vitest';

import { Decimal } from '@pos/domain';

import { BusinessDateScalar, MoneyScalar, PercentScalar } from './scalars';

const stringLiteral = (value: string): ValueNode => ({ kind: Kind.STRING, value });
const intLiteral = (value: string): ValueNode => ({ kind: Kind.INT, value });

describe('Money scalar', () => {
  it('serializes Decimals and strings with exactly two decimals', () => {
    expect(MoneyScalar.serialize(new Decimal('283.2'))).toBe('283.20');
    expect(MoneyScalar.serialize('5')).toBe('5.00');
    expect(MoneyScalar.serialize('0.125')).toBe('0.13');
  });

  it('parses decimal strings, trimming whitespace', () => {
    expect(MoneyScalar.parseValue(' 283.20 ')).toBe('283.20');
    expect(MoneyScalar.parseLiteral(stringLiteral('10'))).toBe('10');
  });

  it.each([283.2, '1.234', 'abc', '', null, '12345678901'])('rejects %j', (value) => {
    expect(() => MoneyScalar.parseValue(value)).toThrow(/Money value is invalid/);
  });

  it('rejects numeric literals so floats never reach the server', () => {
    expect(() => MoneyScalar.parseLiteral(intLiteral('10'))).toThrow(/Money value is invalid/);
  });
});

describe('Percent scalar', () => {
  it('accepts 0–100 with up to two decimals and serializes to two decimals', () => {
    expect(PercentScalar.parseValue('18')).toBe('18');
    expect(PercentScalar.parseValue('100.00')).toBe('100.00');
    expect(PercentScalar.serialize(new Decimal('18'))).toBe('18.00');
  });

  it.each(['100.01', '101', '-1', '12.345', 18])('rejects %j', (value) => {
    expect(() => PercentScalar.parseValue(value)).toThrow(/Percent value is invalid/);
  });
});

describe('BusinessDate scalar', () => {
  it('accepts real calendar dates', () => {
    expect(BusinessDateScalar.parseValue('2026-10-29')).toBe('2026-10-29');
    expect(BusinessDateScalar.serialize('2026-02-28')).toBe('2026-02-28');
  });

  it.each(['2026-02-30', '29-10-2026', '2026-10-29T00:00:00Z', ''])('rejects %j', (value) => {
    expect(() => BusinessDateScalar.parseValue(value)).toThrow(/BusinessDate value is invalid/);
  });

  it('marks parse failures as BAD_USER_INPUT', () => {
    try {
      BusinessDateScalar.parseValue('nope');
    } catch (error) {
      expect(error).toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } });
    }
    expect.assertions(1);
  });
});
