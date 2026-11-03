import { randomUUID } from 'node:crypto';

import { API_URL } from './users.js';

import type { Page } from '@playwright/test';

/** A GraphQL call made by the signed-in page itself (its cookie), for setup the UI does not cover. */
export async function graphqlAsPage<T>(
  page: Page,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  return page.evaluate(
    async (request) => {
      const response = await fetch(`${request.api}/graphql`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: request.query, variables: request.variables }),
      });
      const body = (await response.json()) as { data?: unknown; errors?: unknown };
      if (body.errors !== undefined) {
        throw new Error(JSON.stringify(body.errors));
      }
      return body.data as T;
    },
    { api: API_URL, query, variables },
  );
}

const CREATE_PRODUCT = `mutation Seed($input: CreateProductInput!) {
  createProduct(input: $input) { id name stockPieces }
}`;

/** Creates a product through the API as the page's user; override any input field. */
export async function seedProduct(
  page: Page,
  overrides: Record<string, unknown>,
): Promise<{ id: string; name: string; stockPieces: number }> {
  const input = {
    idempotencyKey: randomUUID(),
    barcode: null,
    name: `Seed ${randomUUID().slice(0, 8)}`,
    nameUrdu: null,
    categoryId: null,
    baseUnitLabel: 'Piece',
    piecesPerBox: 1,
    salePrice: '25.00',
    boxPrice: null,
    costPrice: null,
    taxRate: '0',
    lowStockThreshold: 5,
    lowStockThresholdUnit: 'PIECE',
    initialStockPieces: 20,
    ...overrides,
  };
  const data = await graphqlAsPage<{
    createProduct: { id: string; name: string; stockPieces: number };
  }>(page, CREATE_PRODUCT, { input });
  return data.createProduct;
}

/** Restocks through the API (another counter acting), so the page under test only observes. */
export async function restockViaApi(page: Page, productId: string, pieces: number): Promise<void> {
  await graphqlAsPage(
    page,
    `mutation Restock($input: RestockInput!) { restockProduct(input: $input) { id } }`,
    { input: { idempotencyKey: randomUUID(), productId, boxes: 0, pieces, note: null } },
  );
}
