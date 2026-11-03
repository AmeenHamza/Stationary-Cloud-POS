import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { HttpExceptionFilter } from '../common/errors/http-exception.filter';

import type { AppConfig } from '../config/app-config';
import type { NestExpressApplication } from '@nestjs/platform-express';

/**
 * HTTP hardening and transport settings shared by `main.ts` and the test app factory
 * (ARCHITECTURE.md §7.3, SYSTEM_DESIGN.md §9.2).
 */
export function configureApp(app: NestExpressApplication, config: AppConfig): void {
  app.useLogger(app.get(Logger));
  app.set('trust proxy', config.TRUST_PROXY_HOPS);
  // The web app is same-site (pos.<domain> → api.<domain>), so same-site resources are allowed.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(compression({ threshold: 1024 }));
  app.use(cookieParser());
  app.useBodyParser('json', { limit: '1mb' });
  app.enableCors({
    // A list, not a string: only the web origin gets CORS headers; others get none (SEC-07).
    origin: [config.WEB_ORIGIN],
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['content-type', 'apollo-require-preflight', 'x-pos-csrf', 'x-request-id'],
    maxAge: 600,
  });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
}
