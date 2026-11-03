import 'reflect-metadata';

import { existsSync } from 'node:fs';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../app.module';
import { UnitOfWork } from '../infrastructure/unit-of-work/unit-of-work';
import { AuditService } from '../modules/audit';
import { SessionRevocationService } from '../modules/auth';

/**
 * `pnpm --filter @pos/api cli:revoke-all-sessions --confirm` (DEPLOYMENT.md §10, leaked secret):
 * signs everyone out. Sessions are revoked in PostgreSQL, cached sessions get tombstones, and
 * `session.revoked` events close every open socket on every API instance; staff sign in again.
 */
async function main(): Promise<void> {
  if (!process.argv.includes('--confirm')) {
    console.error('This signs out every user. Run again with --confirm to proceed.');
    process.exitCode = 2;
    return;
  }
  if (process.env['NODE_ENV'] !== 'production' && existsSync('.env')) {
    process.loadEnvFile('.env');
  }
  const app = await NestFactory.createApplicationContext(AppModule.forRoot(process.env), {
    logger: ['error', 'warn'],
    abortOnError: false,
  });
  try {
    const count = await app.get(UnitOfWork).run(async () => {
      const revoked = await app
        .get(SessionRevocationService)
        .revoke({ everyone: true }, 'SECURITY_RESET');
      await app.get(AuditService).record('auth.allSessionsRevoked', null, {
        metadata: { sessions: revoked },
      });
      return revoked;
    });
    console.log(`${String(count)} session(s) revoked. Everyone must sign in again.`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
