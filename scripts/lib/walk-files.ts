import { glob } from 'tinyglobby';

/** Lists files under `root` (POSIX-style relative paths, sorted) matching the globs. */
export async function listFiles(
  root: string,
  include: readonly string[],
  exclude: readonly string[],
): Promise<string[]> {
  const files = await glob([...include], {
    cwd: root,
    ignore: [...exclude],
    dot: true,
    onlyFiles: true,
    expandDirectories: false,
  });
  return files.sort();
}

/** Directories that are never handwritten source (shared by every check). */
export const GENERATED_AND_VENDORED = [
  '**/node_modules/**',
  '**/dist/**',
  '**/.next/**',
  '**/.next-e2e/**',
  '**/playwright-report/**',
  '**/test-results/**',
  '**/.turbo/**',
  '**/coverage/**',
  '**/__generated__/**',
  'packages/database/src/generated/**',
  'packages/contracts/schema.graphql',
  'Screen Shots/**',
  '**/next-env.d.ts',
] as const;
