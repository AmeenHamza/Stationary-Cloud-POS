import { Injectable } from '@nestjs/common';

import { TransactionalClient } from '../../../infrastructure/prisma/transactional-client';

import type { UserRole, UserStatus } from '@pos/contracts';

export interface LoginCandidate {
  id: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
}

export interface ViewerRow {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
}

/** The auth module's narrow view of `users` (DATABASE.md §4.1). Staff CRUD lives in `staff`. */
@Injectable()
export class AuthUsersRepository {
  constructor(private readonly db: TransactionalClient) {}

  findForLogin(username: string): Promise<LoginCandidate | null> {
    return this.db.client.user.findUnique({
      where: { username },
      select: { id: true, passwordHash: true, role: true, status: true },
    });
  }

  findViewer(userId: string): Promise<ViewerRow | null> {
    return this.db.client.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, fullName: true, role: true },
    });
  }

  findPasswordHash(userId: string): Promise<{ passwordHash: string } | null> {
    return this.db.client.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
  }

  async setPassword(userId: string, passwordHash: string, at: Date): Promise<void> {
    await this.db.client.user.update({
      where: { id: userId },
      data: { passwordHash, passwordChangedAt: at, version: { increment: 1 } },
      select: { id: true },
    });
  }
}
