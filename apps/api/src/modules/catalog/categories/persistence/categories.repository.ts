import { Injectable } from '@nestjs/common';

import { keysetOrderBy, keysetWhere, type KeysetSort } from '../../../../common/pagination/keyset';
import { TransactionalClient } from '../../../../infrastructure/prisma/transactional-client';

import type { Prisma } from '@pos/database';

export const CATEGORY_SELECT = {
  id: true,
  name: true,
  iconEmoji: true,
  description: true,
  version: true,
} as const satisfies Prisma.CategorySelect;

export type CategoryRow = Prisma.CategoryGetPayload<{ select: typeof CATEGORY_SELECT }>;

export interface CategoryData {
  name: string;
  iconEmoji: string | null;
  description: string | null;
}

/** `name` is citext, so keyset order and the unique name are both case-insensitive. */
export const CATEGORY_SORT: KeysetSort = { name: 'NAME_ASC', field: 'name', direction: 'asc' };

function filterWhere(search: string | null | undefined): Prisma.CategoryWhereInput {
  return search == null ? {} : { name: { contains: search, mode: 'insensitive' } };
}

/** Categories (DATABASE.md §4.4). Products reference them; deleting moves products to Uncategorised. */
@Injectable()
export class CategoriesRepository {
  constructor(private readonly db: TransactionalClient) {}

  list(search: string | null | undefined, take: number, after: string | null | undefined) {
    const cursor = keysetWhere(CATEGORY_SORT, after) as Prisma.CategoryWhereInput | undefined;
    return this.db.client.category.findMany({
      where: { AND: [filterWhere(search), ...(cursor === undefined ? [] : [cursor])] },
      orderBy: keysetOrderBy(CATEGORY_SORT),
      take,
      select: CATEGORY_SELECT,
    });
  }

  count(search: string | null | undefined): Promise<number> {
    return this.db.client.category.count({ where: filterWhere(search) });
  }

  /** Ids by lower-cased name (`name` is citext, so the match ignores case), for imports. */
  async findIdsByNames(names: readonly string[]): Promise<Map<string, string>> {
    if (names.length === 0) {
      return new Map();
    }
    const rows = await this.db.client.category.findMany({
      where: { name: { in: [...names] } },
      select: { id: true, name: true },
      take: names.length, // names are unique (citext), so at most one row each
    });
    return new Map(rows.map((row) => [row.name.toLowerCase(), row.id]));
  }

  findById(id: string): Promise<CategoryRow | null> {
    return this.db.client.category.findUnique({ where: { id }, select: CATEGORY_SELECT });
  }

  /** Active products per category for one page of ids: a single grouped query. */
  async activeProductCounts(categoryIds: readonly string[]): Promise<Map<string, number>> {
    if (categoryIds.length === 0) {
      return new Map();
    }
    const groups = await this.db.client.product.groupBy({
      by: ['categoryId'],
      where: { categoryId: { in: [...categoryIds] }, archivedAt: null },
      _count: { _all: true },
    });
    return new Map(groups.map((group) => [group.categoryId ?? '', group._count._all]));
  }

  insert(data: CategoryData): Promise<CategoryRow> {
    return this.db.client.category.create({ data, select: CATEGORY_SELECT });
  }

  /** Creates categories by name for an import; a name another request just took is skipped. */
  async insertNames(names: readonly string[]): Promise<number> {
    const created = await this.db.client.category.createMany({
      data: names.map((name) => ({ name })),
      skipDuplicates: true,
    });
    return created.count;
  }

  /** Optimistic update: a stale `version` matches no row (Prisma P2025 → CONFLICT). */
  update(id: string, version: number, data: CategoryData): Promise<CategoryRow> {
    return this.db.client.category.update({
      where: { id, version },
      data: { ...data, version: { increment: 1 } },
      select: CATEGORY_SELECT,
    });
  }

  /** Moves every product (archived ones too) to Uncategorised, then deletes; returns how many moved. */
  async deleteMovingProducts(id: string): Promise<number> {
    const moved = await this.db.client.product.updateMany({
      where: { categoryId: id },
      data: { categoryId: null, version: { increment: 1 } },
    });
    await this.db.client.category.delete({ where: { id }, select: { id: true } });
    return moved.count;
  }
}
