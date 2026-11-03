import 'reflect-metadata';

import { randomBytes } from 'node:crypto';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/bootstrap/configure-app';
import { loadConfig } from '../../src/config/app-config';

import type { NestExpressApplication } from '@nestjs/platform-express';
import type { AddressInfo } from 'node:net';

export interface TestApp {
  app: NestExpressApplication;
  /** Base URL, e.g. http://127.0.0.1:53211 */
  url: string;
  close: () => Promise<void>;
}

export interface TestAppOptions {
  databaseUrl: string;
  redisUrl: string;
  env?: Readonly<Record<string, string>>;
}

export const TEST_METRICS_TOKEN = randomBytes(24).toString('hex');

/** Boots the real API (all modules, real PostgreSQL and Redis) on a random local port. */
export async function startTestApp(options: TestAppOptions): Promise<TestApp> {
  const env = {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: options.databaseUrl,
    DB_POOL_MAX: '5',
    REDIS_URL: options.redisUrl,
    WEB_ORIGIN: 'http://localhost:3000',
    SETTINGS_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    METRICS_TOKEN: TEST_METRICS_TOKEN,
    ...options.env,
  };
  // abortOnError: false — Nest would otherwise call process.abort() on a boot failure.
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(env), {
    logger: false,
    abortOnError: false,
  });
  configureApp(app, loadConfig(env));
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  return { app, url: `http://127.0.0.1:${String(port)}`, close: () => app.close() };
}
