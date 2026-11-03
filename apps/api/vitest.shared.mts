import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Shared by unit and integration tests. SWC emits decorator metadata, which NestJS dependency
 * injection needs. `graphql` resolves to its CommonJS entry exactly as Node does at runtime;
 * otherwise Vite picks `index.mjs` while CommonJS dependencies load `index.js` (two graphql realms).
 */
export const baseConfig = defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  resolve: { alias: [{ find: /^graphql$/, replacement: 'graphql/index.js' }] },
  test: { environment: 'node' },
});
