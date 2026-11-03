import 'reflect-metadata';

import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../app.module';
import { AppError } from '../common/errors/app-error';
import { BootstrapAdminService } from '../modules/staff';

import { readSecret } from './read-secret';

const USAGE =
  'Usage: pnpm --filter @pos/api cli:create-admin --username <name> --full-name "<Full Name>"\n' +
  'The password is prompted for (or read from the first line of piped stdin).';

/** Bootstraps the first admin account (D-10, IMPLEMENTATION_PLAN.md Phase 5 step 6). */
async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { username: { type: 'string' }, 'full-name': { type: 'string' } },
  });
  const username = values.username;
  const fullName = values['full-name'];
  if (username === undefined || fullName === undefined) {
    console.error(USAGE);
    process.exitCode = 2;
    return;
  }
  if (process.env['NODE_ENV'] !== 'production' && existsSync('.env')) {
    process.loadEnvFile('.env');
  }
  const password = await readSecret('Password for the new admin: ');
  const app = await NestFactory.createApplicationContext(AppModule.forRoot(process.env), {
    logger: ['error', 'warn'],
    abortOnError: false,
  });
  try {
    await app.get(BootstrapAdminService).execute({ username, fullName, password });
    console.log(`Admin "${username}" created. Sign in at the web app.`);
  } catch (error) {
    if (!(error instanceof AppError)) {
      throw error;
    }
    const fields = error.details['fieldErrors'];
    console.error(`${error.message}${fields === undefined ? '' : ` ${JSON.stringify(fields)}`}`);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
