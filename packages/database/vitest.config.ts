import { defineConfig } from 'vitest/config';

// Unit tests only; integration tests use vitest.integration.config.ts (real PostgreSQL).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
