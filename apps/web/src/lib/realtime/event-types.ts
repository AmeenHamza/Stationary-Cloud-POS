import type { ShopEventsSubscription } from '@/graphql/__generated__/graphql';

/** One `shopEvents` payload, discriminated by `__typename`. */
export type ShopEvent = ShopEventsSubscription['shopEvents'];

export type EventOf<T extends ShopEvent['__typename']> = Extract<ShopEvent, { __typename: T }>;
