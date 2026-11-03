import { expect, test, type Page } from '@playwright/test';

import { addByName, openAs, openPayment, processPayment } from '../fixtures/billing.fixture.js';
import { seedProduct } from '../fixtures/catalog.fixture.js';
import { E2E_USERS } from '../fixtures/users.js';

/** The admin overview (F-06, F-07): tiles, summaries and charts, live without polling. */
const tileValue = (page: Page, label: string) =>
  page.locator(`[data-tile="${label}"] [data-tile-value]`);

test('the overview tiles update after a sale on another counter (E2E-13)', async ({ browser }) => {
  const admin = await openAs(browser, E2E_USERS.overseer, '/dashboard');
  await seedProduct(admin, { name: 'Overview Marker', salePrice: '75.00' });
  await expect(admin.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await expect(admin.getByText(/^Sales analytics/)).toBeVisible(); // the lazy chart chunk loaded
  const orders = tileValue(admin, "Today's orders");
  await expect(orders).toHaveText(/^\d+$/);
  const before = Number.parseInt((await orders.textContent()) ?? '0', 10);
  const sales = (await tileValue(admin, "Today's sales").textContent()) ?? '';

  const counter = await openAs(browser, E2E_USERS.seller, '/terminal');
  await addByName(counter, 'Overview Marker');
  await processPayment(counter, await openPayment(counter));

  await expect(orders).toHaveText(String(before + 1)); // order.created → coalesced live refetch
  await expect(tileValue(admin, "Today's sales")).not.toHaveText(sales);
  await expect(admin.getByRole('list', { name: 'Payment methods, this month' })).toContainText(
    'Cash',
  );
  await admin.context().close();
  await counter.context().close();
});
