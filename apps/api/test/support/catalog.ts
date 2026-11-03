import { randomUUID } from 'node:crypto';

import { dataOf } from './graphql-client';
import { asUser } from './staff';

export { dataOf };

export const PRODUCT_FIELDS = `id barcode name nameUrdu categoryId categoryName baseUnitLabel piecesPerBox
  salePrice boxPrice taxRate lowStockThresholdPieces lowStockThresholdUnit stockPieces isLowStock
  archivedAt version`;

export const CREATE_PRODUCT = `mutation Create($input: CreateProductInput!) {
  createProduct(input: $input) { ${PRODUCT_FIELDS} costPrice }
}`;

export const UPDATE_PRODUCT = `mutation Update($input: UpdateProductInput!) {
  updateProduct(input: $input) { ${PRODUCT_FIELDS} }
}`;

export const CLONE_PRODUCT = `mutation Clone($input: CloneProductInput!) {
  cloneProduct(input: $input) { ${PRODUCT_FIELDS} costPrice }
}`;

export const ARCHIVE_PRODUCT = `mutation Archive($id: ID!) { archiveProduct(id: $id) { ${PRODUCT_FIELDS} } }`;
export const RESTORE_PRODUCT = `mutation Restore($id: ID!) { restoreProduct(id: $id) { ${PRODUCT_FIELDS} } }`;

export const PRODUCT = `query Product($id: ID!) { product(id: $id) { ${PRODUCT_FIELDS} costPrice } }`;

export const PRODUCTS = `query Products($first: Int, $after: String, $filter: ProductFilter, $sort: ProductSort) {
  products(first: $first, after: $after, filter: $filter, sort: $sort) {
    nodes { id name salePrice stockPieces categoryId } pageInfo { hasNextPage endCursor } totalCount
  }
}`;

export const RESTOCK = `mutation Restock($input: RestockInput!) {
  restockProduct(input: $input) { id stockPieces isLowStock version }
}`;

export const ADJUST = `mutation Adjust($input: AdjustStockInput!) {
  adjustStock(input: $input) { id stockPieces isLowStock version }
}`;

export const CATEGORY_FIELDS = 'id name iconEmoji description version productCount';

export const CATEGORIES = `query Categories($first: Int, $after: String, $filter: CategoriesFilter) {
  categories(first: $first, after: $after, filter: $filter) {
    nodes { ${CATEGORY_FIELDS} } pageInfo { hasNextPage endCursor } totalCount
  }
}`;

export const CREATE_CATEGORY = `mutation Create($input: CreateCategoryInput!) {
  createCategory(input: $input) { ${CATEGORY_FIELDS} }
}`;

export const UPDATE_CATEGORY = `mutation Update($input: UpdateCategoryInput!) {
  updateCategory(input: $input) { ${CATEGORY_FIELDS} }
}`;

export const DELETE_CATEGORY = `mutation Delete($id: ID!) { deleteCategory(id: $id) }`;

export interface ProductNode {
  id: string;
  barcode: string | null;
  name: string;
  nameUrdu: string | null;
  categoryId: string | null;
  categoryName: string | null;
  piecesPerBox: number;
  salePrice: string;
  boxPrice: string | null;
  costPrice?: string | null;
  taxRate: string;
  lowStockThresholdPieces: number;
  lowStockThresholdUnit: string;
  stockPieces: number;
  isLowStock: boolean;
  archivedAt: string | null;
  version: number;
}

export interface CategoryNode {
  id: string;
  name: string;
  version: number;
  productCount: number;
}

/** Valid product fields shared by create and update. */
function productFields(): Record<string, unknown> {
  return {
    barcode: null,
    name: `Item ${randomUUID().slice(0, 8)}`,
    nameUrdu: null,
    categoryId: null,
    baseUnitLabel: 'Piece',
    piecesPerBox: 1,
    salePrice: '10.00',
    boxPrice: null,
    costPrice: '6.00',
    taxRate: '0',
    lowStockThreshold: 5,
    lowStockThresholdUnit: 'PIECE',
  };
}

/** A valid `createProduct` input; override any field. */
export function productInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { idempotencyKey: randomUUID(), ...productFields(), initialStockPieces: 20, ...overrides };
}

/** A valid `updateProduct` input for a product at its current version; override any field. */
export function updateInput(
  product: { id: string; version: number },
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return { ...productFields(), id: product.id, version: product.version, ...overrides };
}

/** `extensions.fieldErrors` of the first error (API.md §4). */
export const fieldErrors = (response: {
  body: { errors?: { extensions?: Record<string, unknown> }[] };
}) => response.body.errors?.[0]?.extensions?.['fieldErrors'];

export async function createProduct(
  baseUrl: string,
  cookie: string,
  overrides: Record<string, unknown> = {},
): Promise<ProductNode> {
  const response = await asUser<{ createProduct: ProductNode }>(baseUrl, cookie, CREATE_PRODUCT, {
    input: productInput(overrides),
  });
  return dataOf(response).createProduct;
}

export async function createCategory(
  baseUrl: string,
  cookie: string,
  name: string,
): Promise<CategoryNode> {
  const response = await asUser<{ createCategory: CategoryNode }>(
    baseUrl,
    cookie,
    CREATE_CATEGORY,
    {
      input: { name },
    },
  );
  return dataOf(response).createCategory;
}

/** `restockProduct` input for a product; override any field. */
export function restockInput(productId: string, overrides: Record<string, unknown> = {}) {
  return { idempotencyKey: randomUUID(), productId, boxes: 0, pieces: 1, note: null, ...overrides };
}
