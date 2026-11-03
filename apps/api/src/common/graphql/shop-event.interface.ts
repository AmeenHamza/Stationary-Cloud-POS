import { Field, GraphQLISODateTime, ID, Int, InterfaceType } from '@nestjs/graphql';

import { EVENT_DEFINITIONS, isEventType, type EventDefinition } from '@pos/contracts';

/**
 * Fields every `shopEvents` payload carries (API.md §7.1). Each module declares its own event types
 * (`@ObjectType({ implements: () => [ShopEvent] })`); the concrete type comes from the event catalog
 * in `@pos/contracts`, the single source of event names.
 */
@InterfaceType('ShopEvent', {
  resolveType: (value: { type: string }) =>
    isEventType(value.type)
      ? (EVENT_DEFINITIONS[value.type] as EventDefinition).graphqlType
      : undefined,
})
export abstract class ShopEvent {
  @Field(() => ID, { description: 'Outbox sequence number; the client de-duplication key.' })
  seq!: string;

  @Field(() => String)
  type!: string;

  @Field(() => Int)
  schemaVersion!: number;

  @Field(() => GraphQLISODateTime)
  occurredAt!: Date;
}
