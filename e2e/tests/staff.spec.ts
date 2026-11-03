import { randomUUID } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';

import { signIn, signOut } from '../fixtures/auth.fixture.js';
import { API_URL, E2E_USERS } from '../fixtures/users.js';

// A fresh random password per run: no credential-like literal in the repository.
const NEW_CASHIER = {
  username: 'e2e.newcomer',
  fullName: 'Nadia Newcomer',
  password: `pw-${randomUUID()}`,
};

/** The manager signs in (landing on the overview) and opens Staff. */
async function openStaff(page: Page): Promise<void> {
  await signIn(page, E2E_USERS.manager);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/staff');
}

test.describe.serial('staff management (F-31, E2E-01)', () => {
  test('an admin creates a cashier, who can then sign in to the terminal', async ({ page }) => {
    await openStaff(page);
    await page.getByRole('button', { name: 'Add staff' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Full name').fill(NEW_CASHIER.fullName);
    await dialog.getByLabel('Username').fill(NEW_CASHIER.username);
    await dialog.getByLabel('Role').selectOption('CASHIER');
    await dialog.getByLabel('Password').fill(NEW_CASHIER.password);
    await dialog.getByRole('button', { name: 'Create account' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('cell', { name: NEW_CASHIER.fullName })).toBeVisible();
    await signOut(page);

    await signIn(page, NEW_CASHIER);
    await expect(page).toHaveURL(/\/terminal$/);
  });

  test('a duplicate username is shown on the field', async ({ page }) => {
    await openStaff(page);
    await page.getByRole('button', { name: 'Add staff' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Full name').fill('Someone Else');
    await dialog.getByLabel('Username').fill(NEW_CASHIER.username);
    await dialog.getByLabel('Password').fill('another-pass-2');
    await dialog.getByRole('button', { name: 'Create account' }).click();
    await expect(dialog.getByText('This username is already taken')).toBeVisible();
  });

  test('disabling a cashier signs out their open session', async ({ page, browser }) => {
    const counter = await browser.newContext();
    const cashierPage = await counter.newPage();
    await signIn(cashierPage, NEW_CASHIER);
    await expect(cashierPage).toHaveURL(/\/terminal$/);

    await openStaff(page);
    const row = page.getByRole('row', { name: new RegExp(NEW_CASHIER.fullName) });
    await row.getByRole('button', { name: 'Disable' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Disable' }).click();
    await expect(row.getByText('Disabled')).toBeVisible();

    await cashierPage.reload();
    await expect(cashierPage).toHaveURL(/\/login$/);
    await counter.close();
  });

  test('the API refuses staff data to a cashier (E2E-11)', async ({ page }) => {
    await signIn(page, E2E_USERS.cashier);
    await expect(page).toHaveURL(/\/terminal$/);
    const code = await page.evaluate(async (api) => {
      const response = await fetch(`${api}/graphql`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: '{ staffUsers { nodes { id } } }' }),
      });
      const body = (await response.json()) as { errors?: { extensions?: { code?: string } }[] };
      return body.errors?.[0]?.extensions?.code;
    }, API_URL);
    expect(code).toBe('FORBIDDEN');
  });

  test('re-enabled, the cashier changes their own password (F-03)', async ({ page }) => {
    await openStaff(page);
    const row = page.getByRole('row', { name: new RegExp(NEW_CASHIER.fullName) });
    await row.getByRole('button', { name: 'Enable' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Enable' }).click();
    await expect(row.getByText('Active')).toBeVisible();
    await signOut(page);

    const newPassword = `pw-${randomUUID()}`;
    await signIn(page, NEW_CASHIER);
    await expect(page).toHaveURL(/\/terminal$/);
    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: 'Change password' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Current password').fill(NEW_CASHIER.password);
    await dialog.getByLabel('New password', { exact: true }).fill(newPassword);
    await dialog.getByLabel('Confirm new password').fill(newPassword);
    await dialog.getByRole('button', { name: 'Change password' }).click();
    await expect(dialog).toBeHidden();
    await signOut(page);

    await signIn(page, NEW_CASHIER); // the old password no longer works
    await expect(page.locator('form').getByRole('alert')).toHaveText(
      'Invalid username or password.',
    );
    await signIn(page, { ...NEW_CASHIER, password: newPassword });
    await expect(page).toHaveURL(/\/terminal$/);
  });
});
