import { defineConfig } from 'vitest/config';

// MIG-01–MIG-05 on local PostgreSQL (TEST_DATABASE_URL), never a remote database.
export default defineConfig({
  test: {
    include: ['test/**/*.int.test.ts'],
    environment: 'node',
    testTimeout: 120_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
});
