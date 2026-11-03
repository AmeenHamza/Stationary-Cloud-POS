import { existsSync } from 'node:fs';

import { createDatabaseClient } from '@pos/database';

import { encryptionKey } from '../infrastructure/crypto/secret-box';

import { reencryptGroqKey } from './reencrypt-groq-key';

const MESSAGES = {
  'no-key': 'No Groq key is stored; nothing to re-encrypt.',
  'already-current': 'The Groq key already opens under the current key; nothing changed.',
  reencrypted: 'The Groq key is now encrypted under the current key.',
} as const;

/**
 * `pnpm --filter @pos/api cli:rotate-settings-key`: after setting a new `SETTINGS_ENCRYPTION_KEY`,
 * re-encrypts the stored Groq key. Reads `DATABASE_URL`, `SETTINGS_ENCRYPTION_KEY` (new) and
 * `PREVIOUS_SETTINGS_ENCRYPTION_KEY` (old) from the environment; never takes keys as arguments.
 */
async function main(): Promise<void> {
  if (process.env['NODE_ENV'] !== 'production' && existsSync('.env')) {
    process.loadEnvFile('.env');
  }
  const url = process.env['DATABASE_URL'];
  const current = process.env['SETTINGS_ENCRYPTION_KEY'];
  const previous = process.env['PREVIOUS_SETTINGS_ENCRYPTION_KEY'];
  if (url === undefined || current === undefined || previous === undefined) {
    console.error(
      'Set DATABASE_URL, SETTINGS_ENCRYPTION_KEY (new) and PREVIOUS_SETTINGS_ENCRYPTION_KEY (old).',
    );
    process.exitCode = 2;
    return;
  }
  const client = createDatabaseClient({ connectionString: url, maxConnections: 1 });
  try {
    const outcome = await reencryptGroqKey(client, encryptionKey(previous), encryptionKey(current));
    console.log(MESSAGES[outcome]);
  } finally {
    await client.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Re-encryption failed.');
  process.exitCode = 1;
});
