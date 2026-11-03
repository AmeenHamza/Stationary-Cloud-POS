import path from 'node:path';

import { runPrisma as runPrismaIn, type CliResult } from '@pos/testkit';

const PACKAGE_ROOT = path.join(import.meta.dirname, '..');

/** Runs this package's Prisma CLI against `databaseUrl` (shared runner in @pos/testkit). */
export function runPrisma(args: readonly string[], databaseUrl: string): CliResult {
  return runPrismaIn(PACKAGE_ROOT, args, databaseUrl);
}
