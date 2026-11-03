import { existsSync } from 'node:fs';
import path from 'node:path';

// Local runs read TEST_DATABASE_URL / TEST_REDIS_URL from apps/api/.env; CI sets them directly.
// Variables already present in the environment win (loadEnvFile never overrides them).
const file = path.join(__dirname, '..', '..', '.env');
if (existsSync(file)) {
  process.loadEnvFile(file);
}
