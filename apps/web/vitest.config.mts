import path from 'node:path';

import { defineConfig } from 'vitest/config';

// Client unit tests (hooks, reducers, realtime routing). Components render in jsdom.
export default defineConfig({
  resolve: { alias: { '@': path.join(import.meta.dirname, 'src') } },
  test: { include: ['src/**/*.test.{ts,tsx}'], environment: 'jsdom' },
});
