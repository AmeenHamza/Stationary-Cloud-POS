import { existsSync } from 'node:fs';
import path from 'node:path';

// Local runs read packages/database/.env; CI provides TEST_DATABASE_URL directly.
const envFile = path.join(import.meta.dirname, '..', '.env');
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}
