import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Refuses to continue unless the database URLs point at a local host.
 * Guards migrate dev, reset and seed (DATABASE.md §9 rule 6, INSTRUCTIONS.md §10).
 */
const envFile = path.join(import.meta.dirname, '..', '.env');
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

for (const name of ['DATABASE_URL', 'DIRECT_DATABASE_URL']) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    console.error(`guard-local: ${name} is not set (see packages/database/.env.example).`);
    process.exit(1);
  }
  const host = new URL(value).hostname;
  if (!LOCAL_HOSTS.has(host)) {
    console.error(`guard-local: refusing to run against non-local ${name} host "${host}".`);
    process.exit(1);
  }
}
