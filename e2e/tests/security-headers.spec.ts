import { expect, test } from '@playwright/test';

import { API_URL } from '../fixtures/users.js';

/**
 * Security headers of the production builds (SYSTEM_DESIGN.md §9.2), the local part of STG-03.
 * HSTS is added by the hosts (Vercel, Railway) on HTTPS, so it is checked on staging only.
 */
test('the web app sends its CSP and hardening headers, without eval (SEC, STG-03)', async ({
  request,
}) => {
  const response = await request.get('/login');
  expect(response.status()).toBe(200);
  const headers = response.headers();
  const csp = headers['content-security-policy'] ?? '';
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain(`connect-src 'self' ${API_URL}`);
  expect(csp).not.toContain('unsafe-eval');
  expect(headers).toMatchObject({
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'same-origin',
  });
  expect(headers['x-powered-by']).toBeUndefined();
});

test('the API sends helmet headers and no framework banner (SEC, STG-03)', async ({ request }) => {
  const response = await request.get(`${API_URL}/health/live`);
  expect(response.status()).toBe(200);
  const headers = response.headers();
  expect(headers).toMatchObject({
    'x-content-type-options': 'nosniff',
    'cross-origin-resource-policy': 'same-site',
  });
  expect(headers['content-security-policy']).toContain("default-src 'self'");
  expect(headers['x-powered-by']).toBeUndefined();
});
