import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { REPO_ROOT, argValue, isMainModule } from './lib/repo.js';
import { finish, type Finding } from './lib/report.js';
import { GENERATED_AND_VENDORED, listFiles } from './lib/walk-files.js';

interface PollingRule {
  id: string;
  pattern: RegExp;
  message: string;
}

/** Text patterns that indicate polling or a suppressed quality rule (CODING_STANDARDS.md §6). */
export const POLLING_RULES: readonly PollingRule[] = [
  {
    id: 'apollo-polling',
    pattern: /\bpollInterval\b|\bstartPolling\s*\(/,
    message: 'Apollo polling is banned',
  },
  { id: 'interval-timer', pattern: /\bsetInterval\s*\(/, message: 'setInterval is banned' },
  {
    id: 'periodic-refetch',
    pattern: /\b(refetchInterval|refreshInterval)\b/,
    message: 'periodic refetch is banned',
  },
  {
    id: 'timed-revalidate',
    pattern: /\brevalidate\s*:\s*\d/,
    message: 'time-based revalidation is banned',
  },
  {
    id: 'duplication-ignore',
    pattern: /jscpd:ignore/,
    message: 'jscpd ignore markers are prohibited',
  },
  {
    id: 'ts-suppression',
    pattern: /@ts-(ignore|nocheck)\b/,
    message: 'TypeScript suppression is banned',
  },
  {
    id: 'protected-disable',
    pattern:
      /eslint-disable[^\n]*(no-restricted-globals|no-restricted-syntax|max-lines|no-explicit-any|ban-ts-comment)/,
    message: 'disabling a protected lint rule is banned',
  },
];

/** Files that define the patterns themselves (rule definitions and this checker's tests). */
export const POLLING_ALLOWLIST: readonly string[] = [
  'packages/config-eslint/restricted.js',
  'scripts/check-no-polling.ts',
  'scripts/__tests__/',
];

const INCLUDE = ['**/*.{ts,tsx,js,jsx,mjs,cjs,json,yml,yaml}'];
const EXCLUDE = [...GENERATED_AND_VENDORED, '**/*.md', 'pnpm-lock.yaml'];

function isAllowlisted(file: string): boolean {
  return POLLING_ALLOWLIST.some((entry) =>
    entry.endsWith('/') ? file.startsWith(entry) : file === entry,
  );
}

/** Scans one file's text and returns a finding per matching line. */
export function scanSource(file: string, source: string): Finding[] {
  const findings: Finding[] = [];
  source.split('\n').forEach((text, index) => {
    for (const rule of POLLING_RULES) {
      if (rule.pattern.test(text)) {
        findings.push({ file, line: index + 1, rule: rule.id, detail: rule.message });
      }
    }
  });
  return findings;
}

export async function checkNoPolling(
  root: string,
): Promise<{ errors: Finding[]; scanned: number }> {
  const files = (await listFiles(root, INCLUDE, EXCLUDE)).filter((file) => !isAllowlisted(file));
  const errors: Finding[] = [];
  for (const file of files) {
    errors.push(...scanSource(file, await readFile(path.join(root, file), 'utf8')));
  }
  return { errors, scanned: files.length };
}

if (isMainModule(import.meta.url)) {
  const result = await checkNoPolling(argValue('--root') ?? REPO_ROOT);
  process.exitCode = finish(`check:no-polling (${String(result.scanned)} files)`, result.errors);
}
