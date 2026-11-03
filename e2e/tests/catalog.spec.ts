import { expect, test, type Page } from '@playwright/test';

import { signIn } from '../fixtures/auth.fixture.js';
import { seedProduct } from '../fixtures/catalog.fixture.js';
import { E2E_USERS } from '../fixtures/users.js';

/**
 * Catalogue flows (F-08–F-12, F-32, Q26) on one signed-in page: the login rate limit allows only a
 * few sign-ins per account, so the steps share it and run in order.
 */
let page: Page;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  await signIn(page, E2E_USERS.stock);
  await expect(page).toHaveURL(/\/dashboard$/);
});

test.afterAll(async () => {
  await page.close();
});

const row = (name: string) => page.getByRole('row').filter({ hasText: name });

async function rowAction(name: string, action: string): Promise<void> {
  await page.getByRole('button', { name: `Actions for ${name}` }).click();
  await page.getByRole('menuitem', { name: action }).click();
}

test('shop settings save and stay saved (Q26)', async () => {
  await page.getByRole('link', { name: 'Settings' }).first().click();
  await page.getByLabel('Shop name').fill('E2E Stationers');
  await page.getByLabel('Default Bill GST %').fill('17');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByText('Shop settings saved.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Shop name')).toHaveValue('E2E Stationers');
  await expect(page.getByLabel('Default Bill GST %')).toHaveValue('17.00');
});

test('a category, then a product added from its card (F-12, F-08)', async () => {
  await page.getByRole('link', { name: 'Categories' }).first().click();
  await page.getByRole('button', { name: 'Add category' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill('E2E Pens');
  await dialog.getByLabel('Icon (emoji, optional)').fill('🖊️');
  await dialog.getByRole('button', { name: 'Add category' }).click();
  const card = page.locator('[data-category-id]').filter({ hasText: 'E2E Pens' });
  await expect(card).toContainText('0 products');

  await card.getByRole('button', { name: 'Add product' }).click();
  await dialog.getByLabel('Name', { exact: true }).fill('E2E Gel Pen');
  await dialog.getByLabel('Barcode (optional)').fill('E2E-0001');
  await dialog.getByLabel('Price per piece (Rs)').fill('30');
  await dialog.getByLabel('Low-stock alert at').fill('5');
  await dialog.getByLabel('Opening stock (pieces)').fill('3');
  await dialog.getByRole('button', { name: 'Add product' }).click();
  await expect(dialog).toBeHidden();
  await expect(card).toContainText('1 product');

  await card.getByRole('link', { name: 'View products' }).click();
  await expect(page).toHaveURL(/\/products\?category=/);
  await expect(row('E2E Gel Pen')).toContainText('Rs 30.00');
  await expect(row('E2E Gel Pen')).toContainText('Low stock');
});

test('restock with preview, then an adjustment with a reason (F-10, F-32)', async () => {
  await rowAction('E2E Gel Pen', 'Restock');
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Loose pieces').fill('4');
  await expect(dialog).toContainText('Adding 4 pcs · New total 7 pcs');
  await dialog.getByRole('button', { name: 'Add stock' }).click();
  await expect(row('E2E Gel Pen').getByTestId('stock')).toContainText('7 pcs');
  await expect(row('E2E Gel Pen')).not.toContainText('Low stock');

  await rowAction('E2E Gel Pen', 'Adjust stock');
  await dialog.getByLabel('Pieces').fill('2');
  await dialog.getByLabel('Reason').selectOption('DAMAGED');
  await dialog.getByRole('button', { name: 'Save adjustment' }).click();
  await expect(row('E2E Gel Pen').getByTestId('stock')).toContainText('5 pcs');
  await expect(row('E2E Gel Pen')).toContainText('Low stock');
});

test('clone per barcode, then archive and find it under archived (F-09, Q16b)', async () => {
  await rowAction('E2E Gel Pen', 'Clone with new barcode');
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('New barcode').fill('E2E-0002');
  await dialog.getByRole('button', { name: 'Add unit' }).click();
  await expect(dialog).toContainText('Added 1: E2E-0002');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(row('E2E-0002')).toContainText('E2E Gel Pen');

  await page.getByRole('row').filter({ hasText: 'E2E-0002' }).getByRole('button').click();
  await page.getByRole('menuitem', { name: 'Archive' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Archive' }).click();
  await expect(row('E2E-0002')).toHaveCount(0);
  await page.getByLabel('Show archived').check();
  await expect(row('E2E-0002')).toContainText('Archived');
});

test('products page forward and back over keyset pages (E2E-10)', async () => {
  for (let index = 0; index < 55; index += 1) {
    await seedProduct(page, { name: `E2E Bulk ${String(index).padStart(2, '0')}` });
  }
  await page.goto('/products');
  await page.getByLabel('Search products').fill('E2E Bulk');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByText('Page 1 · 55 in total')).toBeVisible();
  await expect(row('E2E Bulk 00')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Page 2 · 55 in total')).toBeVisible();
  await expect(row('E2E Bulk 54')).toBeVisible();
  await expect(row('E2E Bulk 00')).toHaveCount(0);
  await page.getByRole('button', { name: 'Previous' }).click();
  await expect(row('E2E Bulk 00')).toBeVisible();
});
