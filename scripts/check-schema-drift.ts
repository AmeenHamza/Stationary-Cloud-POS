import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { REPO_ROOT, isMainModule } from './lib/repo.js';
import { finish, type Finding } from './lib/report.js';

const COMMITTED = 'packages/contracts/schema.graphql';
const EMITTER = 'apps/api/dist/cli/emit-schema.js';

function normalize(sdl: string): string {
  return sdl.replace(/\r\n/g, '\n').trim();
}

/**
 * Re-emits the SDL from the built API and compares it with the committed contract
 * (CODING_STANDARDS.md §7). Works without git.
 */
export function checkSchemaDrift(root: string): { errors: Finding[]; notApplicable: boolean } {
  const committed = path.join(root, COMMITTED);
  const emitter = path.join(root, EMITTER);
  if (!existsSync(emitter)) {
    if (!existsSync(committed)) {
      return { errors: [], notApplicable: true };
    }
    return {
      errors: [{ file: EMITTER, rule: 'not-built', detail: 'build the API first (pnpm build)' }],
      notApplicable: false,
    };
  }
  const dir = mkdtempSync(path.join(tmpdir(), 'pos-schema-'));
  try {
    const out = path.join(dir, 'schema.graphql');
    execFileSync(process.execPath, [emitter, '--out', out], { cwd: root, stdio: 'inherit' });
    const fresh = normalize(readFileSync(out, 'utf8'));
    const current = existsSync(committed) ? normalize(readFileSync(committed, 'utf8')) : '';
    const errors: Finding[] =
      fresh === current
        ? []
        : [
            {
              file: COMMITTED,
              rule: 'drift',
              detail: 'out of date: run pnpm schema:emit and commit it',
            },
          ];
    return { errors, notApplicable: false };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (isMainModule(import.meta.url)) {
  const result = checkSchemaDrift(REPO_ROOT);
  if (result.notApplicable) {
    console.log('check:schema: not applicable yet (no API and no committed schema)');
  } else {
    process.exitCode = finish('check:schema', result.errors);
  }
}
