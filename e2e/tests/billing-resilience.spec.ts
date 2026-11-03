import { expect, test } from '@playwright/test';

import {
  addByName,
  openAs,
  openPayment,
  processPayment,
  setSalePrice,
  stockOf,
} from '../fixtures/billing.fixture.js';
import { seedProduct } from '../fixtures/catalog.fixture.js';
import { E2E_USERS } from '../fixtures/users.js';

/** Sales under bad networks and changing prices (SYSTEM_DESIGN.md §3.4, D-05, ADR-013). */
test.describe.configure({ mode: 'serial' });

const ADMIN_HOME = '/dashboard';
const TERMINAL = '/terminal';

test('offline pauses payment; a lost response confirms the sale exactly once (E2E-08)', async ({
  browser,
}) => {
  const admin = await openAs(browser, E2E_USERS.auditor, ADMIN_HOME);
  const glue = await seedProduct(admin, { name: 'Offline Glue', salePrice: '45.00' });
  const counter = await openAs(browser, E2E_USERS.counter2, TERMINAL);
  await addByName(counter, 'Offline Glue');
  const payment = await openPayment(counter);
  const pay = payment.getByRole('button', { name: /^Process Payment/ });
  await counter.context().setOffline(true);
  await expect(pay).toBeDisabled();
  await expect(payment.getByText('Offline: billing paused.')).toBeVisible();
  await counter.context().setOffline(false);
  await expect(pay).toBeEnabled();

  let dropped = false;
  await counter.route('**/graphql', async (route) => {
    if (!dropped && (route.request().postData() ?? '').includes('mutation CreateSale')) {
      dropped = true;
      await route.fetch(); // the server records the sale…
      await route.abort('internetdisconnected'); // …but the counter never hears back
      return;
    }
    await route.continue();
  });
  await pay.click();
  await expect(counter.locator('[data-sale-status="confirming"]')).toBeVisible();
  await expect(counter.getByRole('dialog', { name: 'Sale complete' })).toBeVisible();
  expect(await stockOf(admin, glue.id)).toBe(19); // the retry replayed the same key: one bill
  await admin.context().close();
  await counter.context().close();
});

test('a price change mid-cart updates the preview; a stale total is refused (E2E-09)', async ({
  browser,
}) => {
  const admin = await openAs(browser, E2E_USERS.auditor, ADMIN_HOME);
  const ink = await seedProduct(admin, { name: 'Price Ink', salePrice: '50.00' });
  let mute = false; // drop live events to the counter, as if it missed them
  const counter = await openAs(browser, E2E_USERS.counter2, TERMINAL, async (page) => {
    await page.routeWebSocket(/\/graphql$/, (ws) => {
      const server = ws.connectToServer();
      server.onMessage((message) => {
        if (!(mute && String(message).includes('"type":"next"'))) ws.send(message);
      });
    });
  });
  const subtotal = counter.getByTestId('cart-subtotal');
  await addByName(counter, 'Price Ink');
  await expect(subtotal).toHaveText('Rs 50.00');
  await setSalePrice(admin, ink.id, '55.00');
  await expect(subtotal).toHaveText('Rs 55.00'); // product.changed patched the cart's product

  mute = true;
  await setSalePrice(admin, ink.id, '60.00');
  const stale = await openPayment(counter);
  await expect(stale.getByTestId('payment-totals')).toContainText('TOTALRs 55.00');
  await stale.getByRole('button', { name: /^Process Payment/ }).click();
  await expect(
    counter.getByText('Prices changed: the total is now Rs 60.00.', { exact: false }),
  ).toBeVisible();
  await expect(subtotal).toHaveText('Rs 60.00'); // the cart re-read its products
  await processPayment(counter, await openPayment(counter));
  expect(await stockOf(admin, ink.id)).toBe(19);
  await admin.context().close();
  await counter.context().close();
});
