import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Absolute path of the repository root (this file lives in scripts/lib). */
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** True when the module with this `import.meta.url` is the process entry point. */
export function isMainModule(metaUrl: string): boolean {
  const entry = process.argv[1];
  return entry !== undefined && pathToFileURL(path.resolve(entry)).href === metaUrl;
}

/** Value following `flag` on the command line, e.g. `--root <dir>`. */
export function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
