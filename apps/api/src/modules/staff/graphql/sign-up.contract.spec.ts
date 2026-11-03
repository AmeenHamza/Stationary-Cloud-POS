import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { buildSchema, isInputObjectType, isEnumType } from 'graphql';
import { describe, expect, it } from 'vitest';

describe('signup GraphQL contract', () => {
  it('exposes the requested mutation, fields and roles in the emitted schema', () => {
    const schema = buildSchema(
      readFileSync(resolve(process.cwd(), '../../packages/contracts/schema.graphql'), 'utf8'),
    );
    const mutation = schema.getMutationType()?.getFields()['signUp'];
    expect(String(mutation?.type)).toBe('Boolean!');
    expect(mutation?.args.map((arg) => [arg.name, String(arg.type)])).toEqual([
      ['input', 'SignUpInput!'],
    ]);
    const input = schema.getType('SignUpInput');
    if (!isInputObjectType(input)) throw new Error('SignUpInput is missing');
    expect(
      Object.fromEntries(
        Object.entries(input.getFields()).map(([name, field]) => [name, String(field.type)]),
      ),
    ).toEqual({
      fullName: 'String!',
      username: 'String!',
      password: 'String!',
      role: 'UserRole!',
      signupSecret: 'String!',
    });
    const role = schema.getType('UserRole');
    if (!isEnumType(role)) throw new Error('UserRole is missing');
    expect(role.getValues().map((value) => value.name)).toEqual(['ADMIN', 'CASHIER']);
  });
});
