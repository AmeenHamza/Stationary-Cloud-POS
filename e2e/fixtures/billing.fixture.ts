import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';

import { signInOnce } from './auth.fixture.js';
import { graphqlAsPage } from './catalog.fixture.js';
import { liveChannel } from './realtime.fixture.js';
import { E2E_USERS, type E2eUser } from './users.js';

/** Counts `window.print()` calls instead of opening the print dialog (TESTING.md E2E-02). */
const PRINT_STUB = `
  window.__prints = 0;
  window.print = () => { window.__prints += 1; };
`;

/**
 * A signed-in page in its own browser context (its own counter), with the live channel open.
 * `prepare` runs before the first navigation (e.g. to route the page's WebSocket). `home` is the
 * path the user lands on.
 */
export async function openAs(
  browser: Browser,
  user: E2eUser,
  home: string,
  prepare?: (page: Page) => Promise<void>,
): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.addInitScript(PRINT_STUB);
  await prepare?.(page);
  const live = liveChannel(page);
  await signInOnce(page, user, home);
  await live;
  return page;
}

/**
 * One admin page and one counter page for a whole spec file: each page load opens a socket, and the
 * suite shares `ws-connect` (30 per minute per IP). The pages exist once `beforeAll` has run, so tests
 * read them from the returned object.
 */
export function useSharedPages(): { admin: Page; counter: Page } {
  const pages = {} as { admin: Page; counter: Page };
  test.beforeAll(async ({ browser }) => {
    pages.admin = await openAs(browser, E2E_USERS.pricer, '/dashboard');
    pages.counter = await openAs(browser, E2E_USERS.counter, '/terminal');
  });
  test.afterAll(async () => {
    await pages.admin.context().close();
    await pages.counter.context().close();
  });
  return pages;
}

export function printCount(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __prints: number }).__prints);
}

/** The cart line for a product sold by the piece. */
export const cartLine = (page: Page, name: string): Locator =>
  page
    .getByRole('complementary', { name: 'Cart' })
    .getByRole('listitem', { name: `${name}, Piece` });

/** Finds a product by name in the grid and taps its tile once. */
export async function addByName(page: Page, name: string): Promise<void> {
  const search = page.getByLabel('Search by name or scan barcode');
  await search.fill(name);
  await search.press('Enter');
  await page.getByRole('button', { name: `Add ${name}`, exact: true }).click();
}

/**
 * A barcode scanner: the whole code and Enter with no pause. A test's separate fill and press can
 * outlast the search box's typing delay on a busy machine, which a real scanner never does.
 */
export async function scanBarcode(page: Page, code: string): Promise<void> {
  await page.getByLabel('Search by name or scan barcode').evaluate((element, value) => {
    const input = element as HTMLInputElement;
    Reflect.set(HTMLInputElement.prototype, 'value', value, input); // the setter React listens past
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.form?.requestSubmit();
  }, code);
}

/** Opens Payment from the cart and returns the dialog. */
export async function openPayment(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Proceed to Payment' }).click();
  return page.getByRole('dialog', { name: 'Payment' });
}

/** Takes payment and returns the bill number from the "Sale complete" dialog. */
export async function processPayment(page: Page, payment: Locator): Promise<string> {
  await payment.getByRole('button', { name: /^Process Payment/ }).click();
  const done = page.getByRole('dialog', { name: 'Sale complete' });
  await expect(done).toContainText(/ORD-\d{8}-\d{3}/);
  const billNumber = /ORD-\d{8}-\d{3}/.exec((await done.textContent()) ?? '')?.[0] ?? '';
  await done.getByRole('button', { name: 'New sale' }).click();
  return billNumber;
}

/** A product's stock as the API reports it. */
export async function stockOf(page: Page, id: string): Promise<number> {
  const data = await graphqlAsPage<{ product: { stockPieces: number } | null }>(
    page,
    'query P($id: ID!) { product(id: $id) { stockPieces } }',
    { id },
  );
  return data.product?.stockPieces ?? Number.NaN;
}

/** An admin changes a product's piece price (another screen acting), keeping its other fields. */
export async function setSalePrice(admin: Page, id: string, salePrice: string): Promise<void> {
  const { product } = await graphqlAsPage<{
    product: Record<string, unknown> & { lowStockThresholdPieces: number };
  }>(
    admin,
    `query P($id: ID!) { product(id: $id) { id barcode baseUnitLabel boxPrice categoryId costPrice
      lowStockThresholdPieces lowStockThresholdUnit name nameUrdu piecesPerBox taxRate version } }`,
    { id },
  );
  const { lowStockThresholdPieces, ...fields } = product;
  await graphqlAsPage(
    admin,
    'mutation U($input: UpdateProductInput!) { updateProduct(input: $input) { id } }',
    { input: { ...fields, salePrice, lowStockThreshold: lowStockThresholdPieces } },
  );
}
