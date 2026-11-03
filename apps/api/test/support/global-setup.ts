import './load-env';

import { createRequire } from 'node:module';
import path from 'node:path';

import { createTestDatabase, migrateDatabase, requireTestEnv } from '@pos/testkit';

import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    /** Name of the migrated template database each test file clones (TESTING.md §2). */
    templateDatabase: string;
  }
}

/** `@pos/database` owns the schema and Prisma CLI; its entry lives in `<root>/dist`. */
function databasePackageRoot(): string {
  const entry = createRequire(__filename).resolve('@pos/database');
  return path.dirname(path.dirname(entry));
}

/** Migrates one template database per run; test files clone it instead of migrating again. */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const template = await createTestDatabase(requireTestEnv('TEST_DATABASE_URL'), {
    prefix: 'api_tpl',
  });
  try {
    migrateDatabase(databasePackageRoot(), template.url);
  } catch (error) {
    await template.drop();
    throw error;
  }
  project.provide('templateDatabase', template.name);
  return () => template.drop();
}
