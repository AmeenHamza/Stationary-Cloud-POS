import { expect, test, type Locator, type Page } from '@playwright/test';

import { signInOnce } from '../fixtures/auth.fixture.js';
import { E2E_USERS } from '../fixtures/users.js';

/** Customer and vendor khata (F-25, F-26, F-28): cashier from the terminal, admin from the panel. */
test.describe.configure({ mode: 'serial' });

const balance = (scope: Page | Locator) => scope.locator('[data-balance-state]').first();

async function addEntry(page: Page, button: string, amount: string, method?: string) {
  await page.getByRole('button', { name: button }).first().click();
  const dialog = page.getByRole('dialog', { name: button }); // the entry dialog, not the modal
  await dialog.getByLabel('Amount (Rs)').fill(amount);
  if (method !== undefined) {
    await dialog.getByLabel('Payment method').selectOption(method);
  }
  await dialog.getByRole('button', { name: button }).click();
  await expect(dialog).toBeHidden();
}

test('a cashier keeps a customer khata from the terminal (F-28, D-11)', async ({ page }) => {
  await signInOnce(page, E2E_USERS.till, '/terminal');
  await page.getByRole('button', { name: 'Khata' }).click();
  const modal = page.getByRole('dialog', { name: 'Customer khata' });
  await modal.getByRole('button', { name: 'Add customer' }).click();
  const form = page.getByRole('dialog', { name: 'Add customer' });
  await form.getByLabel('Name').fill('Khata Customer');
  await form.getByLabel('Phone (optional)').fill('0300 123 4567');
  await form.getByRole('button', { name: 'Add customer' }).click();

  await expect(modal.getByRole('heading', { name: 'Khata Customer' })).toBeVisible();
  await expect(balance(modal)).toHaveText('Settled');
  await addEntry(page, 'Add Udhaar', '500');
  await expect(balance(modal)).toHaveText('Rs 500.00 owed');
  await addEntry(page, 'Receive payment', '200', 'EASYPAISA');
  await expect(balance(modal)).toHaveText('Rs 300.00 owed');
  await expect(modal.locator('[data-entry-type]')).toHaveCount(2);
  await expect(modal.getByRole('button', { name: 'Archive' })).toHaveCount(0); // admins only
});

test('an admin can archive only a settled khata (Q33)', async ({ page }) => {
  await signInOnce(page, E2E_USERS.ledger, '/dashboard');
  await page.getByRole('link', { name: 'Customers' }).first().click();
  await page.getByLabel('Search customers').fill('0300 123');
  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByRole('button', { name: 'Open khata' }).click();
  await expect(page).toHaveURL(/\/customers\/[0-9a-f-]+$/);

  await page.getByRole('button', { name: 'Archive' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Archive' }).click();
  await expect(page.getByText('Settle the balance to zero before archiving.')).toBeVisible();

  await addEntry(page, 'Receive payment', '300', 'CASH');
  await expect(balance(page)).toHaveText('Settled');
  await page.getByRole('button', { name: 'Archive' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Archive' }).click();
  await expect(page.getByRole('button', { name: 'Restore' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Udhaar' })).toHaveCount(0);
});

test('vendor purchases and payments keep the dues (F-26, D-20)', async ({ page }) => {
  await signInOnce(page, E2E_USERS.ledger, '/dashboard');
  await page.getByRole('link', { name: 'Vendors' }).first().click();
  await page.getByRole('button', { name: 'Add vendor' }).click();
  const form = page.getByRole('dialog', { name: 'Add vendor' });
  await form.getByLabel('Name').fill('Paper Supplier');
  await form.getByLabel('Products supplied (optional)').fill('Registers');
  await form.getByRole('button', { name: 'Add vendor' }).click();
  await expect(page).toHaveURL(/\/vendors\/[0-9a-f-]+$/);

  await addEntry(page, 'Add purchase', '1000');
  await addEntry(page, 'Make payment', '400', 'BANK_TRANSFER');
  await expect(balance(page)).toHaveText('Rs 600.00 we owe');
  await expect(page.locator('[data-entry-type="PURCHASE"]')).toHaveCount(1);
});
