import { Field, Int, ObjectType, type FieldMiddleware } from '@nestjs/graphql';

import type { Type } from '@nestjs/common';

@ObjectType('PageInfo')
export class PageInfo {
  @Field(() => Boolean)
  hasNextPage = false;

  @Field(() => String, { nullable: true })
  endCursor: string | null = null;
}

/** The value a list resolver returns; `loadTotalCount` runs only if the client selects totalCount. */
export interface ConnectionValue<T> {
  nodes: T[];
  pageInfo: PageInfo;
  loadTotalCount?: () => Promise<number>;
}

/** Runs the COUNT query lazily, only when `totalCount` is in the selection (API.md §3). */
const lazyTotalCount: FieldMiddleware = async (context) => {
  const source = context.source as Partial<ConnectionValue<unknown>>;
  return source.loadTotalCount === undefined ? null : source.loadTotalCount();
};

/**
 * Base class for every `<Entity>Connection` (ADR-017):
 * `@ObjectType() class ProductConnection extends Connection(Product) {}`.
 */
export function Connection<T>(nodeType: Type<T>) {
  @ObjectType({ isAbstract: true })
  abstract class ConnectionType implements ConnectionValue<T> {
    @Field(() => [nodeType])
    nodes: T[] = [];

    @Field(() => PageInfo)
    pageInfo: PageInfo = new PageInfo();

    @Field(() => Int, { nullable: true, middleware: [lazyTotalCount] })
    totalCount?: number | null;

    loadTotalCount?: () => Promise<number>;
  }
  return ConnectionType;
}
