import { afterEach, describe, expect, it } from 'vitest';

import { checkFileSize, type FileSizeConfig } from '../check-file-size.js';
import { countLines } from '../lib/count-lines.js';

import { linesOf, tempTree } from './temp-tree.js';

const config: FileSizeConfig = {
  maxLines: 200,
  warnLines: 150,
  include: ['**/*.{ts,tsx,css,sql}'],
  exclude: [],
  exceptions: [],
};

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
});

describe('countLines', () => {
  it('counts LF lines, blank lines and a missing final newline', () => {
    expect(countLines('')).toBe(0);
    expect(countLines('a')).toBe(1);
    expect(countLines('a\n')).toBe(1);
    expect(countLines('a\n\nb')).toBe(3);
    expect(countLines('a\r\nb\r\n')).toBe(2);
  });
});

describe('checkFileSize', () => {
  it('fails on a 201-line file, warns from 151 to 200, and accepts 150', async () => {
    const tree = tempTree({
      'at-limit.ts': linesOf(200),
      'target.css': linesOf(150),
      'warn.tsx': linesOf(151),
      'big.sql': linesOf(201),
    });
    cleanup = tree.cleanup;
    const result = await checkFileSize(tree.root, config);
    expect(result.errors.map((e) => e.file)).toEqual(['big.sql']);
    expect(result.warnings.map((w) => w.file)).toEqual(['at-limit.ts', 'warn.tsx']);
  });

  it('ignores generated and vendored paths', async () => {
    const tree = tempTree({
      'apps/web/src/graphql/__generated__/gql.ts': linesOf(500),
      'node_modules/x/index.ts': linesOf(500),
      'packages/database/src/generated/client.ts': linesOf(500),
    });
    cleanup = tree.cleanup;
    const result = await checkFileSize(tree.root, config);
    expect(result.errors).toEqual([]);
    expect(result.scanned).toBe(0);
  });

  it('rejects exceptions without a generator or reason', async () => {
    const tree = tempTree({ 'gen.ts': linesOf(300) });
    cleanup = tree.cleanup;
    const result = await checkFileSize(tree.root, {
      ...config,
      exceptions: [{ path: 'gen.ts', generator: '', reason: '' }],
    });
    expect(result.errors.map((e) => e.rule)).toEqual(['exception']);
  });
});
