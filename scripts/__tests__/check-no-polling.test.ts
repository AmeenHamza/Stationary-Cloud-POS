import { afterEach, describe, expect, it } from 'vitest';

import { checkNoPolling, scanSource } from '../check-no-polling.js';

import { tempTree } from './temp-tree.js';

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
});

describe('scanSource', () => {
  it.each([
    ['useQuery(DOC, { pollInterval: 5000 })', 'apollo-polling'],
    ['observable.startPolling(1000)', 'apollo-polling'],
    ['setInterval(refresh, 1000)', 'interval-timer'],
    ['useSWR(key, { refreshInterval: 10 })', 'periodic-refetch'],
    ['fetch(url, { next: { revalidate: 60 } })', 'timed-revalidate'],
    ['/* jscpd:ignore-start */', 'duplication-ignore'],
    ['// @ts-ignore', 'ts-suppression'],
    ['// eslint-disable-next-line no-restricted-globals', 'protected-disable'],
  ])('flags %s', (line, rule) => {
    expect(scanSource('a.ts', line).map((f) => f.rule)).toEqual([rule]);
  });

  it('accepts debounce and subscription code', () => {
    const clean = ['const t = debounce(search, 250);', 'client.subscribe({ query: SHOP_EVENTS })'];
    expect(scanSource('a.ts', clean.join('\n'))).toEqual([]);
  });

  it('reports the line number', () => {
    expect(scanSource('a.ts', 'ok\nok\nsetInterval(f, 1)')[0]?.line).toBe(3);
  });
});

describe('checkNoPolling', () => {
  it('scans config files and skips markdown and node_modules', async () => {
    const tree = tempTree({
      'apps/web/src/a.ts': 'setInterval(f, 1)\n',
      'apps/web/config.json': '{ "pollInterval": 1 }\n',
      'docs/notes.md': 'setInterval is banned\n',
      'node_modules/lib/index.js': 'setInterval(f, 1)\n',
    });
    cleanup = tree.cleanup;
    const result = await checkNoPolling(tree.root);
    expect(result.errors.map((e) => e.file).sort()).toEqual([
      'apps/web/config.json',
      'apps/web/src/a.ts',
    ]);
  });
});
