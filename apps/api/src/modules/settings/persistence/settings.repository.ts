import { Injectable } from '@nestjs/common';

import { TransactionalClient } from '../../../infrastructure/prisma/transactional-client';

import type { Prisma } from '@pos/database';

/** The shop profile, never the AI key ciphertext (DATABASE.md §4.3). */
export const PROFILE_SELECT = {
  shopName: true,
  address: true,
  phone: true,
  receiptFooter: true,
  exchangeReturnPolicy: true,
  logoDataUrl: true,
  defaultBillGstRate: true,
  version: true,
  updatedAt: true,
} as const satisfies Prisma.ShopSettingsSelect;

export type ProfileRow = Prisma.ShopSettingsGetPayload<{ select: typeof PROFILE_SELECT }>;

export interface ProfileChange {
  shopName: string;
  address: string | null;
  phone: string | null;
  receiptFooter: string | null;
  exchangeReturnPolicy: string | null;
  logoDataUrl: string | null;
  defaultBillGstRate: string;
}

/** Persistence for the single `shop_settings` row (id = 1). */
@Injectable()
export class SettingsRepository {
  constructor(private readonly db: TransactionalClient) {}

  getProfile(): Promise<ProfileRow> {
    return this.db.client.shopSettings.findUniqueOrThrow({
      where: { id: 1 },
      select: PROFILE_SELECT,
    });
  }

  /** Optimistic update: no row matches when `version` is stale (Prisma P2025 → CONFLICT). */
  updateProfile(change: ProfileChange, version: number, actorUserId: string): Promise<ProfileRow> {
    return this.db.client.shopSettings.update({
      where: { id: 1, version },
      data: { ...change, updatedById: actorUserId, version: { increment: 1 } },
      select: PROFILE_SELECT,
    });
  }
}
