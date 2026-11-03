import { existsSync } from 'node:fs';
import path from 'node:path';

import { defineConfig } from 'prisma/config';

// Prisma 7 does not load .env files itself. Local values live in packages/database/.env;
// deployed environments set real variables (which a .env file never overrides).
const envFile = path.join(import.meta.dirname, '.env');
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

// Migrations always use the direct (non-pooled) URL (DATABASE.md §9, DEPLOYMENT.md §4).
const directUrl = process.env['DIRECT_DATABASE_URL'];

export default defineConfig({
  schema: 'prisma/schema',
  migrations: { path: 'prisma/migrations' },
  ...(directUrl === undefined ? {} : { datasource: { url: directUrl } }),
});
