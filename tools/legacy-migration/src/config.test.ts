import { describe, expect, it } from 'vitest';

import { ConfigError, describeUrl, loadConfig } from './config.js';
import { redact } from './log.js';

const SECRET = 'hunter2-not-real';
const env = (extra: Record<string, string> = {}): NodeJS.ProcessEnv => ({
  LEGACY_DATABASE_URL: `postgresql://old:${SECRET}@old-host.example/neondb`,
  TARGET_DATABASE_URL: `postgresql://new:${SECRET}@new-host.example/neondb`,
  ...extra,
});

describe('loadConfig', () => {
  it('reads both URLs, the batch size and the defaults', () => {
    const config = loadConfig({ 'batch-size': '250' }, env());
    expect(config.batchSize).toBe(250);
    expect(config.timeZone).toBe('Asia/Karachi');
    expect(config.naiveZone).toBe('UTC');
    expect(config.outDir).toMatch(/output$/);
  });

  it('refuses a missing or malformed URL without printing the value', () => {
    expect(() => loadConfig({}, { TARGET_DATABASE_URL: 'x' })).toThrow(ConfigError);
    const bad = env({ TARGET_DATABASE_URL: `not a url ${SECRET}` });
    expect(() => loadConfig({}, bad)).toThrow(/TARGET_DATABASE_URL is not a valid URL\.$/);
    expect(() => loadConfig({}, env({ LEGACY_DATABASE_URL: `mysql://u:${SECRET}@h/db` }))).toThrow(
      /must be a postgresql:\/\/ URL/,
    );
  });

  it('refuses the same database on both sides', () => {
    const same = env({ TARGET_DATABASE_URL: `postgresql://x:${SECRET}@old-host.example/neondb` });
    expect(() => loadConfig({}, same)).toThrow(/point at the same database/);
  });

  it('treats blank optional settings as not set, as a copied .env.example leaves them', () => {
    const config = loadConfig({}, env({ MIGRATION_BATCH_SIZE: ' ', MIGRATION_OUTPUT_DIR: '' }));
    expect(config.batchSize).toBe(500);
    expect(config.outDir).toMatch(/output$/);
  });

  it('keeps the batch size between 1 and 5,000', () => {
    expect(() => loadConfig({ 'batch-size': '0' }, env())).toThrow(/batch size/);
    expect(() => loadConfig({ 'batch-size': '5001' }, env())).toThrow(/batch size/);
    expect(() => loadConfig({}, env({ MIGRATION_BATCH_SIZE: '2.5' }))).toThrow(/batch size/);
  });
});

describe('never printing credentials', () => {
  it('describes a URL by host and database only', () => {
    expect(describeUrl(`postgresql://u:${SECRET}@db.example:6543/shop?sslmode=require`)).toBe(
      'db.example:6543/shop',
    );
  });

  it('hides credentials in any logged text', () => {
    const text = `connect failed: postgresql://neondb_owner:${SECRET}@host/neondb and postgres://a:b@c/d`;
    expect(redact(text)).toBe(
      'connect failed: postgresql://***@host/neondb and postgres://***@c/d',
    );
  });
});
