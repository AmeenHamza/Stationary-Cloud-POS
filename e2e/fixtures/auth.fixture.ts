import { expect, type Cookie, type Page } from '@playwright/test';

interface Credentials {
  readonly username: string;
  readonly password: string;
}

/** Signs in through the real login form. */
export async function signIn(page: Page, user: Credentials): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Username').fill(user.username);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/** Session cookies per username, kept for the worker's lifetime (one sign-in per user per run). */
const sessions = new Map<string, Cookie[]>();

/**
 * Signs in through the form the first time a user is needed, then reuses that session in new
 * pages. The API allows 30 sign-ins per IP per 15 minutes (`login-ip`, API.md §8) and the whole
 * suite signs in from 127.0.0.1, so flows that are not about logging in share one session per
 * user. `home` is the path the user lands on, e.g. `/terminal`.
 */
export async function signInOnce(page: Page, user: Credentials, home: string): Promise<void> {
  const landed = new RegExp(`${home}$`);
  const cookies = sessions.get(user.username);
  if (cookies !== undefined) {
    await page.context().addCookies(cookies);
    await page.goto(home);
    await expect(page).toHaveURL(landed);
    return;
  }
  await signIn(page, user);
  // The first sign-in after the API starts is slow (cold start, password hashing).
  await expect(page).toHaveURL(landed, { timeout: 20_000 });
  sessions.set(user.username, await page.context().cookies());
}

/** Signs out through the account menu and waits for the login screen. */
export async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Account menu' }).first().click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
}
