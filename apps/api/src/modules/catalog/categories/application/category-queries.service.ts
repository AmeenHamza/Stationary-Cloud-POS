import { Injectable } from '@nestjs/common';

import { PageInfo, type ConnectionValue } from '../../../../common/pagination/connection.factory';
import { toConnection } from '../../../../common/pagination/keyset';
import { CacheService } from '../../../../infrastructure/cache/cache.service';
import { CATEGORY_SORT, CategoriesRepository } from '../persistence/categories.repository';

import type { CategoriesArgs } from '@pos/validation';

export interface CategoryView {
  id: string;
  name: string;
  iconEmoji: string | null;
  description: string | null;
  version: number;
  productCount: number;
}

interface CachedPage {
  nodes: CategoryView[];
  hasNextPage: boolean;
  endCursor: string | null;
}

const FIRST_PAGE_TTL_SECONDS = 600;

/**
 * `categories` and `category` (API.md §6.1). The unfiltered first page, which every product form and
 * the categories grid open with, comes from the Redis reference cache (generation-invalidated by
 * category and product commands); other pages, searches and the total read PostgreSQL.
 */
@Injectable()
export class CategoryQueriesService {
  constructor(
    private readonly categories: CategoriesRepository,
    private readonly cache: CacheService,
  ) {}

  async list(args: CategoriesArgs): Promise<ConnectionValue<CategoryView>> {
    const search = args.filter?.search ?? null;
    const loadTotalCount = () => this.categories.count(search);
    if (search !== null || args.after != null) {
      return { ...(await this.loadPage(search, args.first, args.after)), loadTotalCount };
    }
    const cached = await this.cache.getOrLoad(
      'categories',
      `first:${String(args.first)}`,
      FIRST_PAGE_TTL_SECONDS,
      async () => {
        const page = await this.loadPage(null, args.first, null);
        const { hasNextPage, endCursor } = page.pageInfo;
        return { nodes: page.nodes, hasNextPage, endCursor } satisfies CachedPage;
      },
    );
    const pageInfo = new PageInfo();
    pageInfo.hasNextPage = cached.hasNextPage;
    pageInfo.endCursor = cached.endCursor;
    return { nodes: cached.nodes, pageInfo, loadTotalCount };
  }

  async byId(id: string): Promise<CategoryView | null> {
    const row = await this.categories.findById(id);
    if (row === null) {
      return null;
    }
    const counts = await this.categories.activeProductCounts([id]);
    return { ...row, productCount: counts.get(id) ?? 0 };
  }

  private async loadPage(
    search: string | null,
    first: number,
    after: string | null | undefined,
  ): Promise<ConnectionValue<CategoryView>> {
    const rows = await this.categories.list(search, first + 1, after);
    const page = toConnection(rows, first, CATEGORY_SORT, (row) => row.name);
    const counts = await this.categories.activeProductCounts(page.nodes.map((row) => row.id));
    const nodes = page.nodes.map((row) => ({ ...row, productCount: counts.get(row.id) ?? 0 }));
    return { nodes, pageInfo: page.pageInfo };
  }
}
