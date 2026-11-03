import { randomBytes } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { signIn, signOut } from '../fixtures/auth.fixture.js';
import { API_URL, E2E_USERS } from '../fixtures/users.js';

test.describe('sign-in, roles and sign-out (F-01, F-04, E2E-01/E2E-11 for existing routes)', () => {
  test('the login page links to secret-protected sign-up (D-10)', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Sign up' }).click();
    await expect(page.getByLabel('Sign-up key')).toBeVisible();
    await expect(page.getByLabel('Role')).toHaveValue('CASHIER');
    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
  });

  test('an invalid sign-up key keeps the form open', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel('Full name').fill('Example');
    await page.getByLabel('Username').fill(`user_${randomBytes(6).toString('hex')}`);
    await page.getByLabel('Password').fill(randomBytes(20).toString('base64url'));
    await page.getByLabel('Role').selectOption('ADMIN');
    await page.getByLabel('Sign-up key').fill(randomBytes(32).toString('hex'));
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.getByText('Invalid signup secret.')).toBeVisible();
  });

  test('a wrong password shows one generic message', async ({ page }) => {
    await signIn(page, { username: E2E_USERS.admin.username, password: 'not-the-password' });
    // Scoped to the form: Next.js adds an empty role=alert route announcer to every page.
    await expect(page.locator('form').getByRole('alert')).toHaveText(
      'Invalid username or password.',
    );
    await expect(page).toHaveURL(/\/login$/);
  });

  test('an admin lands in the admin panel, and signing out returns to login', async ({ page }) => {
    await signIn(page, E2E_USERS.admin);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' }).first()).toBeVisible();
    await signOut(page);
    await page.goto('/staff');
    await expect(page).toHaveURL(/\/login$/); // the session is gone, not just the screen
  });

  test('a cashier lands on the terminal and is sent back from admin pages (E2E-11)', async ({
    page,
  }) => {
    await signIn(page, E2E_USERS.cashier);
    await expect(page).toHaveURL(/\/terminal$/);
    await expect(page.getByText('Billing terminal').first()).toBeVisible();
    await expect(page.getByText(/^\d{2}\/\d{2}\/\d{4}$/)).toBeVisible(); // server business date
    await page.goto('/staff');
    await expect(page).toHaveURL(/\/terminal$/);
  });

  test('the session cookie authenticates API calls made by the page (same-site, cross-port)', async ({
    page,
  }) => {
    await signIn(page, E2E_USERS.cashier);
    await expect(page).toHaveURL(/\/terminal$/);
    const username = await page.evaluate(async (api) => {
      const response = await fetch(`${api}/graphql`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: '{ me { username } }' }),
      });
      return ((await response.json()) as { data?: { me?: { username: string } } }).data?.me
        ?.username;
    }, API_URL);
    expect(username).toBe(E2E_USERS.cashier.username);
  });

  test('the theme toggle switches between light and dark (F-05)', async ({ page }) => {
    await page.goto('/login');
    const html = page.locator('html');
    const startsDark = (await html.getAttribute('class'))?.includes('dark') ?? false;
    await page.getByRole('button', { name: /Switch to (light|dark) theme/ }).click();
    await expect(html).toHaveClass(startsDark ? /^(?!.*dark)/ : /dark/);
    await page.reload();
    await expect(html).toHaveClass(startsDark ? /^(?!.*dark)/ : /dark/); // remembered per browser
  });
});
