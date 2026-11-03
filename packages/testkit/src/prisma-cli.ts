import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { assertLocalUrl } from './env.js';

export interface CliResult {
  status: number | null;
  output: string;
}

/**
 * Runs the Prisma CLI of the `@pos/database` package at `packageRoot` against `databaseUrl`
 * (as both the pooled and the direct URL), without a shell. Local databases only.
 */
export function runPrisma(
  packageRoot: string,
  args: readonly string[],
  databaseUrl: string,
): CliResult {
  assertLocalUrl(databaseUrl);
  const cli = path.join(packageRoot, 'node_modules', 'prisma', 'build', 'index.js');
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: packageRoot,
    env: { ...process.env, DIRECT_DATABASE_URL: databaseUrl, DATABASE_URL: databaseUrl },
    encoding: 'utf8',
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

/** Applies every migration to a test database; throws with the CLI output on failure. */
export function migrateDatabase(packageRoot: string, databaseUrl: string): void {
  const result = runPrisma(packageRoot, ['migrate', 'deploy'], databaseUrl);
  if (result.status !== 0) {
    throw new Error(`prisma migrate deploy failed:\n${result.output}`);
  }
}
