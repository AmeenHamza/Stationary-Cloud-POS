import { afterEach, describe, expect, it } from 'vitest';

import { assertLocalUrl, requireTestEnv } from './env.js';

const saved = process.env['TEST_REDIS_URL'];
afterEach(() => {
  if (saved === undefined) {
    delete process.env['TEST_REDIS_URL'];
  } else {
    process.env['TEST_REDIS_URL'] = saved;
  }
});

describe('assertLocalUrl', () => {
  it.each([
    'postgresql://u:p@localhost:5432/db',
    'redis://127.0.0.1:6379',
    'postgresql://[::1]/db',
  ])('accepts local %s', (url) => {
    expect(() => {
      assertLocalUrl(url);
    }).not.toThrow();
  });

  it('refuses remote hosts so tests can never touch production', () => {
    expect(() => {
      assertLocalUrl('postgresql://u:p@ep-x.neon.tech/db');
    }).toThrow(/non-local host "ep-x.neon.tech"/);
  });
});

describe('requireTestEnv', () => {
  it('returns the value when set', () => {
    process.env['TEST_REDIS_URL'] = 'redis://localhost:6379';
    expect(requireTestEnv('TEST_REDIS_URL')).toBe('redis://localhost:6379');
  });

  it('fails loudly with instructions when missing', () => {
    delete process.env['TEST_REDIS_URL'];
    expect(() => requireTestEnv('TEST_REDIS_URL')).toThrow(/pnpm services:up/);
  });
});
