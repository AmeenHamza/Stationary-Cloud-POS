import { Injectable } from '@nestjs/common';

import { AppError } from '../../../../common/errors/app-error';
import { isUniqueViolation } from '../../../../common/errors/prisma-error.mapper';
import { CacheInvalidation } from '../../../../infrastructure/cache/cache-invalidation';
import { OutboxService } from '../../../../infrastructure/realtime/outbox.service';
import { UnitOfWork } from '../../../../infrastructure/unit-of-work/unit-of-work';
import { AuditService } from '../../../audit';
import { CategoriesRepository, type CategoryRow } from '../persistence/categories.repository';

import type { CategoryView } from './category-queries.service';
import type { Principal } from '../../../../common/auth/principal';
import type { CategoryChange } from '@pos/contracts';
import type { CreateCategoryInput, UpdateCategoryInput } from '@pos/validation';

/** Refusals the user can fix, mapped to fields (API.md §4). */
async function mapCategoryErrors<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    if (isUniqueViolation(error, 'name')) {
      throw new AppError('CONFLICT', 'Some fields are invalid.', {
        fieldErrors: { name: 'A category with this name already exists' },
      });
    }
    if (code === 'P2025') {
      throw new AppError('CONFLICT', 'Someone else changed this category. Reload and try again.');
    }
    if (code === 'P2003') {
      throw new AppError('CONFLICT', 'Products were added to this category meanwhile. Try again.');
    }
    throw error;
  }
}

/**
 * Category commands (F-12). Every change invalidates the cached first page after commit and tells
 * staff screens through `category.changed`; deleting moves the category's products to Uncategorised
 * (Q16b) in the same transaction.
 */
@Injectable()
export class CategoryCommandsService {
  constructor(
    private readonly categories: CategoriesRepository,
    private readonly outbox: OutboxService,
    private readonly invalidation: CacheInvalidation,
    private readonly audit: AuditService,
    private readonly uow: UnitOfWork,
  ) {}

  create(input: CreateCategoryInput, viewer: Principal): Promise<CategoryView> {
    return mapCategoryErrors(() =>
      this.uow.run(async () => {
        const row = await this.categories.insert(input);
        await this.changed('CREATED', row.id, row);
        await this.audit.record('category.created', viewer.userId, {
          entityType: 'category',
          entityId: row.id,
        });
        return { ...row, productCount: 0 };
      }),
    );
  }

  update(input: UpdateCategoryInput, viewer: Principal): Promise<CategoryView> {
    const { id, version, ...data } = input;
    return mapCategoryErrors(() =>
      this.uow.run(async () => {
        const row = await this.categories.update(id, version, data);
        const counts = await this.categories.activeProductCounts([id]);
        await this.changed('UPDATED', id, row);
        await this.audit.record('category.updated', viewer.userId, {
          entityType: 'category',
          entityId: id,
        });
        return { ...row, productCount: counts.get(id) ?? 0 };
      }),
    );
  }

  delete(id: string, viewer: Principal): Promise<boolean> {
    return mapCategoryErrors(() =>
      this.uow.run(async () => {
        if ((await this.categories.findById(id)) === null) {
          throw new AppError('NOT_FOUND', 'This category does not exist.');
        }
        const movedProducts = await this.categories.deleteMovingProducts(id);
        await this.changed('DELETED', id, null);
        await this.audit.record('category.deleted', viewer.userId, {
          entityType: 'category',
          entityId: id,
          metadata: { movedProducts },
        });
        return true;
      }),
    );
  }

  private async changed(change: CategoryChange, categoryId: string, row: CategoryRow | null) {
    await this.outbox.add('category.changed', 'staff', { change, categoryId, category: row });
    this.invalidation.after('categories');
  }
}
