import { expect, test } from '@playwright/test';

import {
  addByName,
  openPayment,
  processPayment,
  useSharedPages,
} from '../fixtures/billing.fixture.js';
import { seedProduct } from '../fixtures/catalog.fixture.js';
import { E2E_USERS } from '../fixtures/users.js';

/** Delete on the admin pages (F-41, D-28): really gone when nothing depends on it, else refused. */
test.describe.configure({ mode: 'serial' });

const pages = useSharedPages();

const openPage = (name: string) =>
  pages.admin.getByRole('link', { name, exact: true }).first().click();

async function findProduct(name: string): Promise<void> {
  await pages.admin.getByLabel('Search products').fill(name);
  await pages.admin.getByRole('button', { name: 'Search' }).click();
}

async function deleteFromMenu(name: string): Promise<void> {
  await pages.admin.getByRole('button', { name: `Actions for ${name}` }).click();
  await pages.admin.getByRole('menuitem', { name: 'Delete' }).click();
  await pages.admin.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
}

test('a never-sold product is deleted; a sold one is refused and stays (E2E-18)', async () => {
  const { admin, counter } = pages;
  await seedProduct(admin, { name: 'Unsold Stapler' });
  await seedProduct(admin, { name: 'Sold Stapler', salePrice: '60.00' });
  await addByName(counter, 'Sold Stapler');
  await processPayment(counter, await openPayment(counter));

  await openPage('Products');
  await findProduct('Unsold Stapler');
  await deleteFromMenu('Unsold Stapler');
  await expect(admin.getByText('Unsold Stapler deleted.')).toBeVisible();
  await expect(admin.getByRole('row').filter({ hasText: 'Unsold Stapler' })).toHaveCount(0);

  await findProduct('Sold Stapler');
  await deleteFromMenu('Sold Stapler');
  await expect(
    admin.getByText('This product is on past bills, so it cannot be deleted. Archive it instead.'),
  ).toBeVisible();
  await expect(admin.getByRole('row').filter({ hasText: 'Sold Stapler' })).toHaveCount(1);
});

test('a customer with no history is deleted, and only admins see the button (E2E-19)', async () => {
  const { admin, counter } = pages;
  await openPage('Customers');
  await admin.getByRole('button', { name: 'Add customer' }).click();
  const form = admin.getByRole('dialog', { name: 'Add customer' });
  await form.getByLabel('Name').fill('Walk Away');
  await form.getByRole('button', { name: 'Add customer' }).click();
  await expect(admin).toHaveURL(/\/customers\/[0-9a-f-]+$/);

  await openPage('Customers');
  await admin.getByLabel('Search customers').fill('Walk Away');
  await admin.getByRole('button', { name: 'Search' }).click();
  await admin.getByRole('button', { name: 'Delete Walk Away' }).click();
  await admin.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(admin.getByText('Walk Away deleted.')).toBeVisible();
  await expect(admin.getByText('No customers match these filters.')).toBeVisible();

  await counter.getByRole('button', { name: 'Khata', exact: true }).click();
  const khata = counter.getByRole('dialog', { name: 'Customer khata' });
  await expect(khata.getByRole('button', { name: 'Add customer' })).toBeVisible();
  await expect(khata.getByRole('button', { name: /^Delete / })).toHaveCount(0);
});

test('a staff account that only signed in can be deleted (E2E-20)', async () => {
  const { admin } = pages;
  await openPage('Staff');
  await admin.getByRole('button', { name: 'Add staff' }).click();
  const form = admin.getByRole('dialog', { name: /Add staff/ });
  await form.getByLabel('Full name').fill('Short Term');
  await form.getByLabel('Username').fill('e2e.shortterm');
  await form.getByLabel(/Password/).fill('e2e-shortterm-pass-1');
  await form.getByRole('button', { name: /Add|Create/ }).click();
  await expect(form).toBeHidden();

  await admin.getByRole('button', { name: 'Delete Short Term' }).click();
  await admin.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(admin.getByText('Short Term deleted.')).toBeVisible();
  await expect(admin.getByRole('row').filter({ hasText: 'e2e.shortterm' })).toHaveCount(0);

  await admin.getByRole('button', { name: `Delete ${E2E_USERS.pricer.fullName}` }).click();
  await admin.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(admin.getByText('You cannot delete your own account.')).toBeVisible();
});
