import { Module } from '@nestjs/common';

import { ServerInfoResolver } from './server-info.resolver';

@Module({ providers: [ServerInfoResolver] })
export class ServerInfoModule {}
