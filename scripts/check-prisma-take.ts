import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { REPO_ROOT, argValue, isMainModule } from './lib/repo.js';
import { finish, type Finding } from './lib/report.js';
import { GENERATED_AND_VENDORED, listFiles } from './lib/walk-files.js';

const INCLUDE = [
  'apps/api/src/**/persistence/**/*.ts',
  'apps/api/src/infrastructure/**/*.ts',
  'tools/**/src/**/*.ts',
];
const EXCLUDE = [...GENERATED_AND_VENDORED, '**/*.spec.ts', '**/*.test.ts'];
const CALL = /\.(findMany|create|update|upsert|delete)\s*\(/g;

/** Returns the text between the call's opening parenthesis and its matching close. */
function callArguments(source: string, openIndex: number): string {
  let depth = 1;
  for (let i = openIndex; i < source.length; i += 1) {
    const char = source[i];
    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openIndex, i);
      }
    }
  }
  return source.slice(openIndex);
}

function lineNumber(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

function precedingLines(source: string, index: number, count: number): string {
  const lines = source.slice(0, index).split('\n');
  return lines.slice(Math.max(0, lines.length - 1 - count)).join('\n');
}

/** `name: value` or the shorthand `name,` / `name }` inside the call's object literal. */
function hasProperty(args: string, name: 'take' | 'select'): boolean {
  return new RegExp(`\\b${name}\\s*[:,}]`).test(args);
}

/**
 * `findMany` needs `take` (or a `// bounded: <reason>` comment). Single-row writes need
 * `select` (or `// no-select: <reason>`), because Prisma otherwise returns every column
 * (NETWORK_OPTIMIZATION.md §5.2). Prisma delegate calls always take an object literal, so calls
 * with other arguments (`map.delete(key)`, `set.delete(item)`) are not Prisma and are skipped.
 */
export function checkPrismaSource(file: string, source: string): Finding[] {
  const findings: Finding[] = [];
  for (const match of source.matchAll(CALL)) {
    const operation = match[1] ?? '';
    const args = callArguments(source, match.index + match[0].length);
    if (!args.trimStart().startsWith('{')) {
      continue;
    }
    const before = precedingLines(source, match.index, 2);
    const line = lineNumber(source, match.index);
    if (operation === 'findMany') {
      if (!hasProperty(args, 'take') && !/\/\/\s*bounded:\s*\S/.test(before)) {
        findings.push({
          file,
          line,
          rule: 'findMany-take',
          detail: 'findMany without take (add take or // bounded: <reason>)',
        });
      }
    } else if (!hasProperty(args, 'select') && !/\/\/\s*no-select:\s*\S/.test(before)) {
      findings.push({
        file,
        line,
        rule: 'write-select',
        detail: `${operation} without select (returns every column)`,
      });
    }
  }
  return findings;
}

export async function checkPrismaTake(
  root: string,
): Promise<{ errors: Finding[]; scanned: number }> {
  const files = await listFiles(root, INCLUDE, EXCLUDE);
  const errors: Finding[] = [];
  for (const file of files) {
    errors.push(...checkPrismaSource(file, await readFile(path.join(root, file), 'utf8')));
  }
  return { errors, scanned: files.length };
}

if (isMainModule(import.meta.url)) {
  const result = await checkPrismaTake(argValue('--root') ?? REPO_ROOT);
  process.exitCode = finish(`check:prisma-take (${String(result.scanned)} files)`, result.errors);
}
