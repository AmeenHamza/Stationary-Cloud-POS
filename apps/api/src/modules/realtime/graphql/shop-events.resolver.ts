import { Context, Field, ObjectType, Resolver, Subscription } from '@nestjs/graphql';

import { Authenticated } from '../../../common/auth/access-policy';
import { CurrentViewer } from '../../../common/auth/current-viewer.decorator';
import { AppError } from '../../../common/errors/app-error';
import { ShopEvent } from '../../../common/graphql/shop-event.interface';
import { RealtimeHub } from '../application/realtime-hub';

import type { Principal } from '../../../common/auth/principal';
import type { GraphqlContext } from '../../../common/graphql/graphql-context';
import type { ShopEventValue } from '../application/event-stream';

/** Sent to a socket after its API instance may have missed events (API.md §7.2). */
@ObjectType('ResyncRequiredEvent', { implements: () => [ShopEvent] })
export class ResyncRequiredEvent extends ShopEvent {
  @Field(() => String, { description: 'REDIS_RECONNECTED' })
  reason!: string;
}

/** `shopEvents`: the one subscription per browser tab (API.md §7.1, rule 1: no polling). */
@Resolver()
export class ShopEventsResolver {
  constructor(private readonly hub: RealtimeHub) {}

  @Subscription(() => ShopEvent, { resolve: (value: ShopEventValue) => value })
  @Authenticated()
  shopEvents(
    @CurrentViewer() viewer: Principal,
    @Context() context: GraphqlContext,
  ): AsyncIterableIterator<ShopEventValue> {
    if (context.transport !== 'ws') {
      throw new AppError('BAD_USER_INPUT', 'Subscribe over WebSocket.');
    }
    return this.hub.open(viewer, context.socket);
  }
}
