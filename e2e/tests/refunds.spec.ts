import { expect, test } from '@playwright/test';

import {
  addByName,
  cartLine,
  openAs,
  openPayment,
  printCount,
  processPayment,
  stockOf,
} from '../fixtures/billing.fixture.js';
import { seedProduct } from '../fixtures/catalog.fixture.js';
import { E2E_USERS } from '../fixtures/users.js';

/** Refunds (F-16, F-28, D-11, D-14): from the terminal modal and the admin order history. */
test('a partial then a full refund restocks and updates the bill (E2E-04)', async ({ browser }) => {
  const admin = await openAs(browser, E2E_USERS.auditor, '/dashboard');
  const pens = await seedProduct(admin, { name: 'Refund Pens', salePrice: '40.00' });
  const counter = await openAs(browser, E2E_USERS.refunder, '/terminal');
  await addByName(counter, 'Refund Pens');
  const line = cartLine(counter, 'Refund Pens');
  await line.getByRole('button', { name: 'One more Refund Pens' }).click();
  await line.getByRole('button', { name: 'One more Refund Pens' }).click();
  const bill = await processPayment(counter, await openPayment(counter));
  expect(await stockOf(admin, pens.id)).toBe(17);

  await counter.getByRole('button', { name: 'Refund', exact: true }).click();
  const modal = counter.getByRole('dialog', { name: 'Refund a bill' });
  await modal.getByLabel('Search by order number').fill(bill);
  await modal.getByRole('button', { name: 'Search' }).click();
  await modal.getByRole('button', { name: `Refund ${bill}` }).click();
  const partial = counter.getByRole('dialog', { name: `Refund ${bill}` });
  await partial.getByRole('button', { name: 'One more Refund Pens' }).click();
  await expect(partial).toContainText('1 unit(s) selected across 1 item line(s)');
  await partial.getByRole('button', { name: 'Refund Selected · Rs 40.00' }).click();
  await expect(partial).toBeHidden();
  await expect(modal.getByRole('row').filter({ hasText: bill })).toContainText('Partly refunded');
  expect(await stockOf(admin, pens.id)).toBe(18); // refunds always restock (D-14)

  await admin.getByRole('link', { name: 'Orders' }).first().click();
  await admin.getByLabel('Search by order number').fill(bill);
  await admin.getByRole('button', { name: 'Search' }).click();
  const row = admin.getByRole('row').filter({ hasText: bill });
  await expect(row).toContainText('Partly refunded');
  await row.getByRole('button', { name: `Refund ${bill}` }).click();
  const rest = admin.getByRole('dialog', { name: `Refund ${bill}` });
  await expect(rest).toContainText('already refunded Rs 40.00');
  await rest.getByRole('button', { name: 'Refund All · Rs 80.00' }).click();
  await expect(rest).toBeHidden();
  await expect(row).toContainText('Refunded');
  await expect(row.getByRole('button', { name: `Refund ${bill}` })).toBeDisabled();
  expect(await stockOf(admin, pens.id)).toBe(20);

  await row.getByRole('button', { name: `Reprint ${bill}` }).click();
  await expect.poll(() => printCount(admin)).toBe(1);
  await admin.context().close();
  await counter.context().close();
});
