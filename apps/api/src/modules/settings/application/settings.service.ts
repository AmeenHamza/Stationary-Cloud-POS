import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import { CacheInvalidation } from '../../../infrastructure/cache/cache-invalidation';
import { CacheService } from '../../../infrastructure/cache/cache.service';
import { OutboxService } from '../../../infrastructure/realtime/outbox.service';
import { UnitOfWork } from '../../../infrastructure/unit-of-work/unit-of-work';
import { AuditService } from '../../audit';
import { SettingsRepository, type ProfileRow } from '../persistence/settings.repository';

import type { Principal } from '../../../common/auth/principal';
import type { UpdateShopSettingsInput } from '@pos/validation';

/** Cached as plain strings so the cache round-trip keeps Decimal and Date values exact. */
export interface ShopProfile {
  shopName: string;
  address: string | null;
  phone: string | null;
  receiptFooter: string | null;
  exchangeReturnPolicy: string | null;
  logoDataUrl: string | null;
  defaultBillGstRate: string;
  version: number;
  updatedAt: string;
}

const PROFILE_TTL_SECONDS = 3_600;

function toProfile(row: ProfileRow): ShopProfile {
  return {
    ...row,
    defaultBillGstRate: row.defaultBillGstRate.toString(), // the Percent scalar formats on output
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Shop profile and default Bill GST (Q26). Reads come from the Redis reference cache (≤ 1 h,
 * generation-invalidated after each change); billing reads the rate from PostgreSQL in its own
 * transaction, so a stale cache can never change a bill (rule 5).
 */
@Injectable()
export class SettingsService {
  constructor(
    private readonly settings: SettingsRepository,
    private readonly cache: CacheService,
    private readonly invalidation: CacheInvalidation,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly uow: UnitOfWork,
  ) {}

  profile(): Promise<ShopProfile> {
    return this.cache.getOrLoad('settings', 'profile', PROFILE_TTL_SECONDS, async () =>
      toProfile(await this.settings.getProfile()),
    );
  }

  async update(input: UpdateShopSettingsInput, viewer: Principal): Promise<ShopProfile> {
    const { version, ...change } = input;
    try {
      return await this.uow.run(async () => {
        const row = await this.settings.updateProfile(change, version, viewer.userId);
        await this.outbox.add('settings.changed', 'staff', { version: row.version });
        await this.audit.record('settings.updated', viewer.userId, {
          entityType: 'settings',
          entityId: '1',
          metadata: { fields: Object.keys(change) },
        });
        this.invalidation.after('settings');
        return toProfile(row);
      });
    } catch (error) {
      if ((error as { code?: unknown }).code === 'P2025') {
        throw new AppError('CONFLICT', 'Someone else changed the settings. Reload and try again.');
      }
      throw error;
    }
  }
}
