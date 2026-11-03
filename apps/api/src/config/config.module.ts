import { Global, Module, type DynamicModule } from '@nestjs/common';

import { APP_CONFIG, loadConfig, type EnvSource } from './app-config';

/** Provides the validated `AppConfig` everywhere. Tests pass an explicit environment. */
@Global()
@Module({})
export class ConfigModule {
  static forRoot(env: EnvSource): DynamicModule {
    return {
      module: ConfigModule,
      providers: [{ provide: APP_CONFIG, useValue: loadConfig(env) }],
      exports: [APP_CONFIG],
    };
  }
}
