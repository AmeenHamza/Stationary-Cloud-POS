import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { REPO_ROOT, isMainModule } from './lib/repo.js';

/** Workspace roots checked by dependency-cruiser (CODING_STANDARDS.md §4). */
export const DEPENDENCY_ROOTS = ['apps', 'packages', 'tools', 'e2e', 'scripts'] as const;

/** Only roots that exist yet: early phases have no apps/ or tools/. */
export function existingRoots(root: string): string[] {
  return DEPENDENCY_ROOTS.filter((dir) => existsSync(path.join(root, dir)));
}

if (isMainModule(import.meta.url)) {
  // Run the CLI entry with Node directly: no shell, so paths with spaces are safe.
  const cli = path.join(
    REPO_ROOT,
    'node_modules',
    'dependency-cruiser',
    'bin',
    'dependency-cruiser.mjs',
  );
  const result = spawnSync(
    process.execPath,
    [cli, '--config', '.dependency-cruiser.cjs', ...existingRoots(REPO_ROOT)],
    { cwd: REPO_ROOT, stdio: 'inherit' },
  );
  process.exitCode = result.status ?? 1;
}
