import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

import { APP_CONFIG, type AppConfig } from '../../config/app-config';

import { REDACT_PATHS } from './redact-paths';
import { requestIdOf } from './request-id';

import type { IncomingMessage } from 'node:http';

/**
 * Structured JSON logs (INSTRUCTIONS.md §12): one line per request with the request id and the
 * GraphQL operation name; health checks are not logged; secrets are redacted.
 */
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        pinoHttp: {
          level: config.LOG_LEVEL,
          redact: { paths: [...REDACT_PATHS], censor: '[redacted]' },
          genReqId: requestIdOf,
          autoLogging: { ignore: (request) => request.url?.startsWith('/health') ?? false },
          customProps: (request) => {
            const body: unknown = (request as IncomingMessage & { body?: unknown }).body;
            const operation =
              typeof body === 'object' && body !== null && 'operationName' in body
                ? String(body.operationName)
                : undefined;
            return operation === undefined ? {} : { operation };
          },
        },
      }),
    }),
  ],
})
export class LoggingModule {}
