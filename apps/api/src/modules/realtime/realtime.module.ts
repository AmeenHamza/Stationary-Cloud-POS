import { Global, Module } from '@nestjs/common';

import { WS_LIFECYCLE } from '../../common/graphql/ws-lifecycle';
import { AuthModule } from '../auth';

import { RealtimeHub } from './application/realtime-hub';
import { WsConnectionService } from './application/ws-connection.service';
import { ShopEventsResolver } from './graphql/shop-events.resolver';

/**
 * Live updates over WebSocket (SYSTEM_DESIGN.md §5). Global because it provides WS_LIFECYCLE to the
 * GraphQL module in `common`; sessions are resolved through the auth module's PRINCIPAL_RESOLVER.
 */
@Global()
@Module({
  imports: [AuthModule],
  providers: [
    RealtimeHub,
    WsConnectionService,
    ShopEventsResolver,
    { provide: WS_LIFECYCLE, useExisting: WsConnectionService },
  ],
  exports: [WS_LIFECYCLE, RealtimeHub, WsConnectionService],
})
export class RealtimeModule {}
