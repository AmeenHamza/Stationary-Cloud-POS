import { Inject } from '@nestjs/common';
import { Field, ObjectType, Query, Resolver } from '@nestjs/graphql';

import { Public } from '../../common/auth/access-policy';
import { BusinessDateScalar } from '../../common/graphql/scalars';
import { ClockService } from '../../common/time/clock.service';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';

@ObjectType('ServerInfo')
export class ServerInfo {
  @Field(() => String)
  version = '';

  @Field(() => BusinessDateScalar, { description: "Today's date in the business time zone." })
  businessDate = '';
}

/** `serverInfo` (API.md §6.1): the terminal header date comes from the server's business date. */
@Resolver(() => ServerInfo)
export class ServerInfoResolver {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly clock: ClockService,
  ) {}

  @Query(() => ServerInfo)
  @Public()
  serverInfo(): ServerInfo {
    const info = new ServerInfo();
    info.version = this.config.APP_VERSION;
    info.businessDate = this.clock.businessDate();
    return info;
  }
}
