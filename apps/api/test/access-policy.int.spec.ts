import { METHOD_METADATA } from '@nestjs/common/constants';
import { DiscoveryService } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ACCESS_POLICY } from '../src/common/auth/access-policy';

import { startHarness, type Harness } from './support/harness';

const RESOLVER_TYPE_METADATA = 'graphql:resolver_type'; // @nestjs/graphql: Query | Mutation | Subscription

let h: Harness;

beforeAll(async () => {
  h = await startHarness();
});

afterAll(async () => {
  await h.stop();
});

/** `Class.method` for every handler (selected by `isHandler`) that has no access policy. */
function unguardedHandlers(
  classes: readonly (new (...args: never[]) => unknown)[],
  isHandler: (method: object) => boolean,
): string[] {
  const missing: string[] = [];
  for (const type of classes) {
    const prototype = type.prototype as object | undefined; // factory providers are arrow functions
    if (prototype === undefined) {
      continue;
    }
    for (const name of Object.getOwnPropertyNames(prototype)) {
      // Descriptors, not `prototype[name]`: reading would run getters of framework classes.
      const method: unknown = Object.getOwnPropertyDescriptor(prototype, name)?.value;
      if (name === 'constructor' || typeof method !== 'function' || !isHandler(method)) {
        continue;
      }
      if (
        !Reflect.hasMetadata(ACCESS_POLICY, method) &&
        !Reflect.hasMetadata(ACCESS_POLICY, type)
      ) {
        missing.push(`${type.name}.${name}`);
      }
    }
  }
  return missing;
}

describe('SEC-01: every resolver and controller method declares an access policy', () => {
  it('GraphQL operations', () => {
    const resolvers = h.app
      .get(DiscoveryService)
      .getProviders()
      .map((wrapper) => wrapper.metatype)
      .filter((type): type is new () => unknown => typeof type === 'function');
    const operations = unguardedHandlers(resolvers, (method) =>
      ['Query', 'Mutation', 'Subscription'].includes(
        String(Reflect.getMetadata(RESOLVER_TYPE_METADATA, method)),
      ),
    );
    expect(operations).toEqual([]);
  });

  it('REST routes', () => {
    const controllers = h.app
      .get(DiscoveryService)
      .getControllers()
      .map((wrapper) => wrapper.metatype)
      .filter((type): type is new () => unknown => typeof type === 'function');
    expect(controllers.length).toBeGreaterThan(0);
    expect(
      unguardedHandlers(controllers, (method) => Reflect.hasMetadata(METHOD_METADATA, method)),
    ).toEqual([]);
  });
});
