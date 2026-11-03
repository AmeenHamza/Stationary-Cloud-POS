import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { countLines } from './lib/count-lines.js';
import { REPO_ROOT, argValue, isMainModule } from './lib/repo.js';
import { finish, type Finding } from './lib/report.js';
import { GENERATED_AND_VENDORED, listFiles } from './lib/walk-files.js';

export interface FileSizeException {
  path: string;
  generator: string;
  reason: string;
}

export interface FileSizeConfig {
  maxLines: number;
  warnLines: number;
  include: string[];
  exclude: string[];
  exceptions: FileSizeException[];
}

export interface FileSizeResult {
  errors: Finding[];
  warnings: Finding[];
  scanned: number;
}

/** Applies the 200-line rule (CODING_STANDARDS.md §2) to every counted file under `root`. */
export async function checkFileSize(root: string, config: FileSizeConfig): Promise<FileSizeResult> {
  const errors: Finding[] = [];
  const warnings: Finding[] = [];
  for (const exception of config.exceptions) {
    if (exception.generator.trim() === '' || exception.reason.trim() === '') {
      errors.push({
        file: exception.path,
        rule: 'exception',
        detail: 'exceptions need a generator and a reason (generated artifacts only)',
      });
    }
  }
  const exempt = new Set(config.exceptions.map((e) => e.path));
  const exclude = [...GENERATED_AND_VENDORED, ...config.exclude];
  const files = await listFiles(root, config.include, exclude);
  for (const file of files) {
    if (exempt.has(file)) {
      continue;
    }
    const lines = countLines(await readFile(path.join(root, file), 'utf8'));
    if (lines > config.maxLines) {
      errors.push({
        file,
        rule: 'max-lines',
        detail: `${String(lines)} lines (max ${String(config.maxLines)})`,
      });
    } else if (lines > config.warnLines) {
      warnings.push({
        file,
        rule: 'target',
        detail: `${String(lines)} lines (target ≤ ${String(config.warnLines)})`,
      });
    }
  }
  return { errors, warnings, scanned: files.length };
}

export async function loadFileSizeConfig(): Promise<FileSizeConfig> {
  const raw = await readFile(new URL('./file-size.config.json', import.meta.url), 'utf8');
  return JSON.parse(raw) as FileSizeConfig;
}

if (isMainModule(import.meta.url)) {
  const root = argValue('--root') ?? REPO_ROOT;
  const result = await checkFileSize(root, await loadFileSizeConfig());
  process.exitCode = finish(
    `check:file-size (${String(result.scanned)} files)`,
    result.errors,
    result.warnings,
  );
}
