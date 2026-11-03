import { defineConfig } from 'tsup';

// Compiled package (DECISIONS.md ADR-030): ESM + CJS + declarations. `shims` provides
// import.meta.url in the CJS build, which the generated Prisma client relies on.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  shims: true,
  target: 'node24',
});
