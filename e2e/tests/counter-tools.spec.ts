import { expect, test } from '@playwright/test';

import { cartLine, openPayment, printCount, useSharedPages } from '../fixtures/billing.fixture.js';
import { seedProduct } from '../fixtures/catalog.fixture.js';

/** The terminal's list view (F-38), item discounts (F-39) and bills from the khata (F-40). */
test.describe.configure({ mode: 'serial' });

const pages = useSharedPages();

test('the terminal offers a list view, and remembers the choice (E2E-15)', async () => {
  const { admin, counter } = pages;
  await seedProduct(admin, { name: 'Listed Ruler', salePrice: '40.00', initialStockPieces: 33 });
  await seedProduct(admin, { name: 'Listed Square', salePrice: '60.00', initialStockPieces: 12 });
  await seedProduct(admin, { name: 'Listed Compass', salePrice: '80.00', initialStockPieces: 9 });
  const search = counter.getByLabel('Search by name or scan barcode');
  await search.fill('Listed');
  const rows = counter.locator('li[data-product-id]');

  const view = counter.getByRole('combobox', { name: 'View' });
  await expect(view).toHaveValue('CARD');
  await expect(rows).toHaveCount(0);
  await view.selectOption('LIST');
  await expect(rows).toHaveCount(3);

  // Three lists side by side: the rows share a line, each to the right of the one before.
  const boxes = await Promise.all([0, 1, 2].map((index) => rows.nth(index).boundingBox()));
  expect(new Set(boxes.map((box) => box?.y)).size).toBe(1);
  const lefts = boxes.map((box) => box?.x ?? 0);
  expect(lefts).toEqual([...lefts].sort((a, b) => a - b));
  expect(new Set(lefts).size).toBe(3);

  // A wide screen has the room for one line per row, under the headings.
  const size = counter.viewportSize();
  await counter.setViewportSize({ width: 1920, height: 1080 });
  for (const heading of ['Product', 'Stock', 'Price']) {
    await expect(counter.getByText(heading, { exact: true })).toHaveCount(3);
    await expect(counter.getByText(heading, { exact: true }).first()).toBeVisible();
  }
  if (size !== null) await counter.setViewportSize(size);

  const row = rows.filter({ hasText: 'Listed Ruler' });
  await expect(row).toContainText('33 pcs');
  await expect(row).toContainText('Rs 40.00');
  await expect(row.getByText('Add', { exact: true })).toHaveCount(0);

  // A tap anywhere on the row adds it: the price here, then the name adds a second.
  await row.getByText('Rs 40.00').click();
  await expect(cartLine(counter, 'Listed Ruler')).toBeVisible();
  await row.getByText('Listed Ruler').click();
  await expect(counter.getByTestId('cart-subtotal')).toHaveText('Rs 80.00');

  await counter.reload();
  await expect(counter.getByRole('combobox', { name: 'View' })).toHaveValue('LIST');
  await counter.getByRole('button', { name: 'Clear' }).click();
  await counter.getByRole('combobox', { name: 'View' }).selectOption('CARD');
});

test('a discount on one item, with the overall one on what is left (E2E-16, FIN-26)', async () => {
  const { admin, counter } = pages;
  await seedProduct(admin, { name: 'Discounted Atlas', salePrice: '1000.00' });
  await seedProduct(admin, { name: 'Full Price Globe', salePrice: '500.00' });
  for (const name of ['Discounted Atlas', 'Full Price Globe']) {
    await counter.getByLabel('Search by name or scan barcode').fill(name);
    await counter.getByRole('button', { name: `Add ${name}`, exact: true }).click();
  }

  const payment = await openPayment(counter);
  const totals = payment.getByTestId('payment-totals');
  await payment.getByRole('button', { name: 'Discount on specific items' }).click();
  await payment.getByLabel('Discount type for Discounted Atlas').selectOption('PERCENT');
  await payment.getByLabel('Discount percentage for Discounted Atlas').fill('10');
  await expect(totals).toContainText('Item discount-Rs 100.00');
  await expect(totals).toContainText('TOTALRs 1,400.00');

  await payment.getByRole('button', { name: 'Percentage (%)' }).click();
  await payment.getByLabel('Discount percentage', { exact: true }).fill('10');
  await expect(totals).toContainText('Discount-Rs 140.00');
  await expect(totals).toContainText('TOTALRs 1,260.00');

  await payment.getByRole('button', { name: /^Process Payment/ }).click();
  const done = counter.getByRole('dialog', { name: 'Sale complete' });
  await expect(done).toContainText('Rs 1,260.00');
  await done.getByRole('button', { name: 'New sale' }).click();
});

test('a cashier regenerates a customer bill from the khata (E2E-17, F-40)', async () => {
  const { admin, counter } = pages;
  await seedProduct(admin, { name: 'Credit Binder', salePrice: '350.00' });
  await counter.getByLabel('Search by name or scan barcode').fill('Credit Binder');
  await counter.getByRole('button', { name: 'Add Credit Binder', exact: true }).click();
  const payment = await openPayment(counter);
  await payment.getByRole('button', { name: 'Udhaar (credit)' }).click();
  await payment.getByLabel('Search customers').fill('Loyal Regular');
  await payment.getByRole('button', { name: 'Add', exact: true }).click();
  await payment.getByRole('button', { name: /^Process Payment/ }).click();
  const done = counter.getByRole('dialog', { name: 'Sale complete' });
  await expect(done).toContainText(/ORD-\d{8}-\d{3}/);
  const bill = /ORD-\d{8}-\d{3}/.exec((await done.textContent()) ?? '')?.[0] ?? '';
  await done.getByRole('button', { name: 'New sale' }).click();
  const printsAfterSale = await printCount(counter);

  await counter.getByRole('button', { name: 'Khata', exact: true }).click();
  const khata = counter.getByRole('dialog', { name: 'Customer khata' });
  await khata.getByLabel('Search customers').fill('Loyal Regular');
  await khata.getByRole('button', { name: 'Search' }).click();
  await khata.getByRole('button', { name: 'Open khata' }).click();
  await expect(khata.locator('[data-entry-type="CREDIT_SALE"]')).toContainText(bill);

  await khata.getByRole('button', { name: `Regenerate bill ${bill}` }).click();
  await expect.poll(() => printCount(counter)).toBe(printsAfterSale + 1);
  const receipt = counter.locator(`[data-receipt="${bill}"]`);
  await expect(receipt).toContainText('Loyal Regular');
  await expect(receipt).toContainText('Rs 350.00');
});
