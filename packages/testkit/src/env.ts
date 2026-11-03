/**
 * Integration tests need real services (TESTING.md §2). A missing variable fails loudly with
 * instructions; tests are never silently skipped.
 */
export function requireTestEnv(name: 'TEST_DATABASE_URL' | 'TEST_REDIS_URL'): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    throw new Error(
      `${name} is not set. Start local services with "pnpm services:up" and set ${name} ` +
        '(see TESTING.md §2 and the package .env.example).',
    );
  }
  return value;
}

/** Throws unless the URL points at a local host: tests must never touch a remote database. */
export function assertLocalUrl(url: string): void {
  const host = new URL(url).hostname;
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'];
  if (!local.includes(host)) {
    throw new Error(`Refusing to run tests against non-local host "${host}".`);
  }
}
