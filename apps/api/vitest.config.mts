import { defineConfig, mergeConfig } from 'vitest/config';

import { baseConfig } from './vitest.shared.mjs';

// Unit tests: no database, Redis or network.
export default mergeConfig(baseConfig, defineConfig({ test: { include: ['src/**/*.spec.ts'] } }));
