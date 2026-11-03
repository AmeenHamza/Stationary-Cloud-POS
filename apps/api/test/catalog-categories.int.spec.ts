import { describe, expect, it } from 'vitest';

import * as catalog from './support/catalog';
import { errorCode } from './support/graphql-client';
import { useRoles } from './support/roles';
import { asUser } from './support/staff';

import type { CategoryNode } from './support/catalog';

const t = useRoles();

interface CategoryPage {
  nodes: CategoryNode[];
  totalCount: number;
}

const firstPage = async (cookie = t.cashier) =>
  catalog.dataOf(await asUser<{ categories: CategoryPage }>(t.h.url, cookie, catalog.CATEGORIES))
    .categories;

const byName = (page: CategoryPage, name: string) => page.nodes.find((node) => node.name === name);

describe('categories (F-12)', () => {
  it('creates categories, refuses case-insensitive duplicates and cashiers', async () => {
    const created = await catalog.createCategory(t.h.url, t.admin, 'Notebooks');
    expect(created).toMatchObject({ name: 'Notebooks', productCount: 0, version: 1 });
    const duplicate = await asUser(t.h.url, t.admin, catalog.CREATE_CATEGORY, {
      input: { name: 'notebooks' },
    });
    expect(errorCode(duplicate)).toBe('CONFLICT');
    expect(duplicate.body.errors?.[0]?.extensions?.['fieldErrors']).toHaveProperty('name');
    const denied = await asUser(t.h.url, t.cashier, catalog.CREATE_CATEGORY, {
      input: { name: 'X' },
    });
    expect(errorCode(denied)).toBe('FORBIDDEN');
  });

  it('serves the cached first page and invalidates it on change (RED-03)', async () => {
    const category = await catalog.createCategory(t.h.url, t.admin, 'Art');
    expect(byName(await firstPage(), 'Art')?.productCount).toBe(0);
    expect(byName(await firstPage(), 'Art')?.productCount).toBe(0); // second read: cache hit

    await catalog.createProduct(t.h.url, t.admin, { categoryId: category.id });
    expect(byName(await firstPage(), 'Art')?.productCount).toBe(1);

    const renamed = await asUser(t.h.url, t.admin, catalog.UPDATE_CATEGORY, {
      input: { id: category.id, name: 'Art supplies', version: category.version },
    });
    expect(errorCode(renamed)).toBeUndefined();
    const page = await firstPage();
    expect(byName(page, 'Art')).toBeUndefined();
    expect(byName(page, 'Art supplies')?.productCount).toBe(1);

    const stale = await asUser(t.h.url, t.admin, catalog.UPDATE_CATEGORY, {
      input: { id: category.id, name: 'Art again', version: category.version },
    });
    expect(errorCode(stale)).toBe('CONFLICT');
  });

  it('deletes a category and moves its products to Uncategorised (Q16b)', async () => {
    const category = await catalog.createCategory(t.h.url, t.admin, 'Temporary');
    const product = await catalog.createProduct(t.h.url, t.admin, { categoryId: category.id });
    const deleted = await asUser<{ deleteCategory: boolean }>(
      t.h.url,
      t.admin,
      catalog.DELETE_CATEGORY,
      {
        id: category.id,
      },
    );
    expect(catalog.dataOf(deleted).deleteCategory).toBe(true);
    expect(byName(await firstPage(), 'Temporary')).toBeUndefined();

    const moved = await asUser<{ product: { categoryId: string | null; version: number } }>(
      t.h.url,
      t.admin,
      catalog.PRODUCT,
      { id: product.id },
    );
    expect(catalog.dataOf(moved).product).toMatchObject({ categoryId: null, version: 2 });
    const again = await asUser(t.h.url, t.admin, catalog.DELETE_CATEGORY, { id: category.id });
    expect(errorCode(again)).toBe('NOT_FOUND');
  });

  it('searches by name and pages with the shared limits', async () => {
    await catalog.createCategory(t.h.url, t.admin, 'Geometry boxes');
    const found = catalog.dataOf(
      await asUser<{ categories: CategoryPage }>(t.h.url, t.cashier, catalog.CATEGORIES, {
        filter: { search: 'geometry' },
      }),
    ).categories;
    expect(found.nodes.map((node) => node.name)).toEqual(['Geometry boxes']);
    expect(found.totalCount).toBe(1);
    const tooMany = await asUser(t.h.url, t.cashier, catalog.CATEGORIES, { first: 51 });
    expect(errorCode(tooMany)).toBe('BAD_USER_INPUT');
  });
});
