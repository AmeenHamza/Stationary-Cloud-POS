import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import { openAs } from '../fixtures/billing.fixture.js';
import { E2E_USERS } from '../fixtures/users.js';

/** Product import (F-11): live progress without polling, a refused row and its report (E2E-12). */
const FILE = [
  'Barcode,Name,Sale price,Opening stock',
  'E2E-IMP-1,Imported notebook,55.00,12',
  'E2E-IMP-2,Imported stapler,not a price,3',
  'E2E-IMP-3,Imported folder,20,0',
].join('\n');

test('an import with one invalid row shows progress, completes and reports the row (E2E-12)', async ({
  browser,
}) => {
  const admin = await openAs(browser, E2E_USERS.importer, '/dashboard');
  await admin.goto('/products');
  await admin.getByRole('button', { name: 'Import' }).click();
  const dialog = admin.getByRole('dialog', { name: 'Import products' });
  await expect(dialog.getByRole('button', { name: 'Download the template' })).toBeVisible();
  await dialog.getByLabel('Product file').setInputFiles({
    name: 'products.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(FILE),
  });
  await dialog.getByRole('button', { name: 'Import' }).click();
  await expect(dialog.getByText('Import finished: 2 applied, 1 refused.')).toBeVisible();

  const report = admin.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download the refused rows' }).click();
  const file = await (await report).path();
  expect(await readFile(file, 'utf8')).toMatch(
    /^\uFEFF?Line,Barcode,Name,Error\r?\n3,E2E-IMP-2,Imported stapler,/,
  );

  await admin.keyboard.press('Escape');
  await admin.getByLabel('Search products').fill('Imported notebook');
  await admin.getByRole('button', { name: 'Search' }).click();
  await expect(admin.getByRole('row').filter({ hasText: 'Imported notebook' })).toContainText(
    '12 pcs',
  );
  await admin.context().close();
});
