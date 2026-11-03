import { defineConfig, mergeConfig } from 'vitest/config';

import { baseConfig } from './vitest.shared.mjs';

// Integration tests against real PostgreSQL and Redis (TESTING.md §2). Files run one at a time:
// Redis Pub/Sub channels are server-wide, so files never share a Redis concurrently.
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ['test/**/*.int.spec.ts'],
      globalSetup: ['test/support/global-setup.ts'],
      setupFiles: ['test/support/load-env.ts'],
      fileParallelism: false,
      testTimeout: 60_000,
      hookTimeout: 120_000,
    },
  }),
);
