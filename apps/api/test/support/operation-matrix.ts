import { DiscoveryService } from '@nestjs/core';
import {
  getNamedType,
  isCompositeType,
  isEnumType,
  isInputObjectType,
  isListType,
  isNonNullType,
  type GraphQLField,
  type GraphQLInputType,
  type GraphQLSchema,
} from 'graphql';

import { ACCESS_POLICY, type AccessPolicy } from '../../src/common/auth/access-policy';

import type { INestApplication } from '@nestjs/common';

const RESOLVER_TYPE = 'graphql:resolver_type';
const RESOLVER_NAME = 'graphql:resolver_name';

/** Values every custom scalar accepts (they are parsed before any guard runs). */
const SCALAR_SAMPLES: Readonly<Record<string, unknown>> = {
  ID: '0192f0c1-0000-7000-8000-00000000abcd',
  String: 'x',
  Int: 1,
  Float: 1,
  Boolean: false,
  BusinessDate: '2026-01-01',
  DateTime: '2026-01-01T00:00:00.000Z',
  Money: '1.00',
  Percent: '1',
};

/** `Query.field` / `Mutation.field` → the access policy on its resolver method (or class). */
export function operationPolicies(app: INestApplication): Map<string, AccessPolicy> {
  const policies = new Map<string, AccessPolicy>();
  for (const wrapper of app.get(DiscoveryService).getProviders()) {
    const type = wrapper.metatype as (new () => unknown) | null | undefined;
    const prototype = (typeof type === 'function' ? type.prototype : undefined) as
      object | undefined;
    if (prototype === undefined || type == null) {
      continue;
    }
    for (const name of Object.getOwnPropertyNames(prototype)) {
      const method: unknown = Object.getOwnPropertyDescriptor(prototype, name)?.value;
      const kind: unknown =
        typeof method === 'function' ? Reflect.getMetadata(RESOLVER_TYPE, method) : undefined;
      if (kind !== 'Query' && kind !== 'Mutation') {
        continue;
      }
      const field =
        (Reflect.getMetadata(RESOLVER_NAME, method as object) as string | undefined) ?? name;
      const policy = (Reflect.getMetadata(ACCESS_POLICY, method as object) ??
        Reflect.getMetadata(ACCESS_POLICY, type)) as AccessPolicy;
      policies.set(`${kind}.${field}`, policy);
    }
  }
  return policies;
}

/** The smallest well-typed value: required input fields only, one list item, the first enum value. */
function sample(type: GraphQLInputType): unknown {
  if (isNonNullType(type)) {
    return sample(type.ofType);
  }
  if (isListType(type)) {
    return [sample(type.ofType)];
  }
  if (isEnumType(type)) {
    return type.getValues()[0]?.name;
  }
  if (isInputObjectType(type)) {
    const required = Object.values(type.getFields()).filter(
      (field) => isNonNullType(field.type) && field.defaultValue === undefined,
    );
    return Object.fromEntries(required.map((field) => [field.name, sample(field.type)]));
  }
  return SCALAR_SAMPLES[type.name] ?? 'x';
}

/** An operation calling only `field`, with its required arguments as variables. */
export function minimalOperation(
  operation: 'query' | 'mutation',
  field: GraphQLField<unknown, unknown>,
): { query: string; variables: Record<string, unknown> } {
  const required = field.args.filter(
    (arg) => isNonNullType(arg.type) && arg.defaultValue === undefined,
  );
  const definitions = required.map((arg, index) => `$a${String(index)}: ${String(arg.type)}`);
  const args = required.map((arg, index) => `${arg.name}: $a${String(index)}`);
  const selection = isCompositeType(getNamedType(field.type)) ? ' { __typename }' : '';
  const head = definitions.length === 0 ? '' : `(${definitions.join(', ')})`;
  const call = args.length === 0 ? field.name : `${field.name}(${args.join(', ')})`;
  return {
    query: `${operation} Matrix${head} { ${call}${selection} }`,
    variables: Object.fromEntries(
      required.map((arg, index) => [`a${String(index)}`, sample(arg.type)]),
    ),
  };
}

/** Every Query and Mutation field of the served schema. */
export function schemaOperations(schema: GraphQLSchema) {
  const of = (operation: 'query' | 'mutation', root: 'Query' | 'Mutation') =>
    Object.values(
      (operation === 'query' ? schema.getQueryType() : schema.getMutationType())?.getFields() ?? {},
    ).map((field) => ({ operation, key: `${root}.${field.name}`, field }));
  return [...of('query', 'Query'), ...of('mutation', 'Mutation')];
}
