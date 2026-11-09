import { parseArgs } from 'node:util';

import { apply } from './commands/apply.js';
import { dryRun } from './commands/dry-run.js';
import { check, verify } from './commands/verify.js';
import { ConfigError, loadConfig } from './config.js';
import { RunLog, redact } from './log.js';

const HELP = `Legacy migration: old POS database → new POS database (README.md).

  pnpm --filter @pos/legacy-migration migrate <command> [options]

Commands
  check                      Compare schema-map.ts with the old database (names only).
  dry-run                    Read the old database, plan, check the new one. Writes nothing.
  apply --confirm <code>     Migrate. <code> is the fingerprint printed by the dry run.
  verify                     Compare the old and new databases again. Writes nothing.

Options
  --batch-size <n>           Rows per read page and per INSERT (default 500, or MIGRATION_BATCH_SIZE).
  --out <folder>             Where run folders go (default tools/legacy-migration/output).

Exit code 0 means success; anything else means read the report.`;

/** Runs one command; returns the process exit code. */
async function main(argv: readonly string[]): Promise<number> {
  const { positionals, values } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      confirm: { type: 'string' },
      'batch-size': { type: 'string' },
      out: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const command = positionals[0];
  if (values.help === true || command === undefined) {
    process.stdout.write(`${HELP}\n`);
    return command === undefined && values.help !== true ? 1 : 0;
  }
  const log = new RunLog();
  const config = loadConfig({ 'batch-size': values['batch-size'], out: values.out });
  switch (command) {
    case 'check':
      return (await check(config, log)).ok ? 0 : 1;
    case 'dry-run':
      return (await dryRun(config, log)).ok ? 0 : 1;
    case 'apply':
      return (await apply(config, log, values.confirm)).ok ? 0 : 1;
    case 'verify':
      return (await verify(config, log)).ok ? 0 : 1;
    default:
      process.stderr.write(`Unknown command "${command}".\n\n${HELP}\n`);
      return 1;
  }
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    const message = error instanceof ConfigError ? error.message : redact(String(error));
    process.stderr.write(`[error] ${message}\n`);
    process.exitCode = 1;
  },
);
