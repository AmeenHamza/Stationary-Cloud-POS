import 'reflect-metadata';

import { writeFileSync } from 'node:fs';
import path from 'node:path';

import { NestFactory } from '@nestjs/core';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { printSchema } from 'graphql';

import { AppModule } from '../app.module';

/**
 * Writes the code-first SDL to packages/contracts/schema.graphql (ADR-004). Uses a schema-only
 * environment pointing at closed local ports: building the schema needs no database or Redis,
 * which also proves the API boots while both are unreachable.
 */
const SCHEMA_ONLY_ENV = {
  NODE_ENV: 'development',
  LOG_LEVEL: 'silent',
  DATABASE_URL: 'postgresql://schema:schema@127.0.0.1:1/schema',
  REDIS_URL: 'redis://127.0.0.1:1',
  WEB_ORIGIN: 'http://localhost:3000',
  SETTINGS_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
};

async function emit(): Promise<void> {
  const index = process.argv.indexOf('--out');
  const target = index >= 0 ? process.argv[index + 1] : undefined;
  if (target === undefined) {
    throw new Error('Usage: emit-schema --out <file>');
  }
  const app = await NestFactory.create(AppModule.forRoot(SCHEMA_ONLY_ENV), { logger: false });
  await app.init();
  const { schema } = app.get(GraphQLSchemaHost);
  writeFileSync(path.resolve(target), `${printSchema(schema)}\n`);
  await app.close();
  console.log(`Schema written to ${target}`);
}

emit().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
