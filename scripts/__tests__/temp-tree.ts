import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/** Creates a throwaway directory tree for checker tests and returns its root. */
export function tempTree(files: Record<string, string>): { root: string; cleanup: () => void } {
  const root = mkdtempSync(path.join(tmpdir(), 'pos-check-'));
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  return {
    root,
    cleanup: () => {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

/** A file body with exactly `count` physical lines. */
export function linesOf(count: number): string {
  return (
    Array.from({ length: count }, (_, i) => `const line${String(i)} = ${String(i)};`).join('\n') +
    '\n'
  );
}
