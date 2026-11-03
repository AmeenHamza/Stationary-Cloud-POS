import { getOperationAST } from 'graphql';
import { describe, expect, it } from 'vitest';

import { LIVE_QUERIES } from '@/lib/realtime/live-queries';

import { CategoriesDocument, CategoryOptionsDocument } from './graphql/categories.documents';
import { LowStockCountDocument, LowStockProductsDocument } from './graphql/inventory.documents';
import { ProductsDocument } from './graphql/products.documents';

import type { DocumentNode } from 'graphql';

const nameOf = (document: DocumentNode): string | undefined =>
  getOperationAST(document)?.name?.value;

describe('catalogue live query names (SYSTEM_DESIGN.md §5.4)', () => {
  it('name real operations, so live events refetch the screens that show the data', () => {
    expect([CategoriesDocument, CategoryOptionsDocument].map(nameOf)).toEqual(
      LIVE_QUERIES.categories,
    );
    expect(LIVE_QUERIES.products).toEqual(expect.arrayContaining([ProductsDocument].map(nameOf)));
    expect([LowStockCountDocument, LowStockProductsDocument].map(nameOf)).toEqual(
      LIVE_QUERIES.lowStock,
    );
  });
});
