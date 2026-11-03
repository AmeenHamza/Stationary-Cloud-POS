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

/** The billing terminal (F-18–F-23, F-33, F-34, D-15): real browser, API and database. */
test.describe.configure({ mode: 'serial' });

const ADMIN_HOME = '/dashboard';
const TERMINAL = '/terminal';

test('a cash sale with one scan and one search prints and clears the cart (E2E-02)', async ({
  browser,
}) => {
  const admin = await openAs(browser, E2E_USERS.pricer, ADMIN_HOME);
  const pencil = await seedProduct(admin, {
    name: 'Scan Pencil',
    barcode: '8960000000011',
    salePrice: '120.00',
  });
  await seedProduct(admin, { name: 'Search Eraser', salePrice: '70.00' });
  const counter = await openAs(browser, E2E_USERS.counter, TERMINAL);

  const search = counter.getByLabel('Search by name or scan barcode');
  await search.fill('8960000000011');
  await search.press('Enter'); // an exact barcode adds one piece (Q22)
  await expect(cartLine(counter, 'Scan Pencil')).toBeVisible();
  await expect(search).toHaveValue('');
  await addByName(counter, 'Search Eraser');
  await expect(counter.getByTestId('cart-subtotal')).toHaveText('Rs 190.00');

  const payment = await openPayment(counter);
  await payment.getByRole('checkbox', { name: 'Bill GST' }).check();
  await expect(payment.getByTestId('payment-totals')).toContainText('Bill GST (18%)Rs 34.20');
  await expect(payment.getByTestId('payment-totals')).toContainText('TOTALRs 224.20');
  await processPayment(counter, payment);
  expect(await printCount(counter)).toBe(1);
  await expect(counter.getByText('Tap a product to add it')).toBeVisible();
  expect(await stockOf(admin, pencil.id)).toBe(19);
  await admin.context().close();
  await counter.context().close();
});

test('an Udhaar sale to a quick-added customer lands on their khata (E2E-03)', async ({
  browser,
}) => {
  const admin = await openAs(browser, E2E_USERS.pricer, ADMIN_HOME);
  await seedProduct(admin, { name: 'Udhaar Register', salePrice: '350.00' });
  const counter = await openAs(browser, E2E_USERS.counter, TERMINAL);
  await addByName(counter, 'Udhaar Register');
  const payment = await openPayment(counter);
  await payment.getByRole('button', { name: 'Udhaar (credit)' }).click();
  await expect(payment.getByRole('button', { name: /^Process Payment/ })).toBeDisabled();
  await payment.getByLabel('Search customers').fill('Credit Buyer');
  await payment.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(payment.getByText('Udhaar to Credit Buyer')).toBeVisible();
  const bill = await processPayment(counter, payment);
  expect(bill).not.toBe('');

  await counter.getByRole('button', { name: 'Khata' }).click();
  const khata = counter.getByRole('dialog', { name: 'Customer khata' });
  await khata.getByLabel('Search customers').fill('Credit Buyer');
  await khata.getByRole('button', { name: 'Search' }).click();
  await khata.getByRole('button', { name: 'Open khata' }).click();
  await expect(khata.locator('[data-balance-state]').first()).toHaveText('Rs 350.00 owed');
  await expect(khata.locator('[data-entry-type="CREDIT_SALE"]')).toHaveCount(1);
  await admin.context().close();
  await counter.context().close();
});

test('a sale on one counter updates the tile on another without reload (E2E-06)', async ({
  browser,
}) => {
  const admin = await openAs(browser, E2E_USERS.pricer, ADMIN_HOME);
  await seedProduct(admin, { name: 'Shared Sharpener', salePrice: '30.00' });
  const first = await openAs(browser, E2E_USERS.counter, TERMINAL);
  const second = await openAs(browser, E2E_USERS.counter2, TERMINAL);
  const search = second.getByLabel('Search by name or scan barcode');
  await search.fill('Shared Sharpener');
  await search.press('Enter');
  const tile = second.getByRole('button', { name: 'Add Shared Sharpener', exact: true });
  await expect(tile).toContainText('20 pcs');

  await addByName(first, 'Shared Sharpener');
  await cartLine(first, 'Shared Sharpener')
    .getByRole('button', { name: /^One more/ })
    .click();
  await processPayment(first, await openPayment(first));
  await expect(tile).toContainText('18 pcs'); // stock.changed patched the cached tile
  for (const page of [admin, first, second]) await page.context().close();
});

test('a 3-line scan-based bill sends 3 lookups and 1 sale, nothing else (NET-07)', async ({
  browser,
}) => {
  const admin = await openAs(browser, E2E_USERS.pricer, ADMIN_HOME);
  for (const index of [1, 2, 3]) {
    await seedProduct(admin, {
      name: `Net Item ${String(index)}`,
      barcode: `89600000001${String(index)}`,
    });
  }
  const counter = await openAs(browser, E2E_USERS.counter, TERMINAL);
  await expect(counter.getByRole('button', { name: /^Add / }).first()).toBeVisible(); // grid loaded
  const sent: string[] = [];
  counter.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/graphql')) {
      sent.push(String((request.postDataJSON() as { operationName?: string }).operationName));
    }
  });
  const search = counter.getByLabel('Search by name or scan barcode');
  for (const index of [1, 2, 3]) {
    await search.fill(`89600000001${String(index)}`);
    await search.press('Enter');
    await expect(cartLine(counter, `Net Item ${String(index)}`)).toBeVisible();
  }
  await processPayment(counter, await openPayment(counter));
  expect(sent).toEqual(['ProductByBarcode', 'ProductByBarcode', 'ProductByBarcode', 'CreateSale']);
  await admin.context().close();
  await counter.context().close();
});
